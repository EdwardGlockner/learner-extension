import { createId } from "../lib/id";
import { getDaysBetween, stableHash } from "../lib/time";
import type {
  DailyPlan,
  ExtensionState,
  LessonGeneration,
  PlanTopicReason,
  Topic
} from "../shared/types";
import { inferEffectivePrerequisites } from "./topicInference";

export interface TopicScoreBreakdown {
  topic: Topic;
  score: number;
  reviewCandidate: boolean;
  varietyPenalty: number;
  rationale: string[];
}

export function getLatestLesson(lessons: LessonGeneration[], topicId: string): LessonGeneration | undefined {
  return lessons
    .filter((lesson) => lesson.topicId === topicId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function compareTopicsByBaseOrder(left: Topic, right: Topic): number {
  return (
    left.manuallyOrderedIndex - right.manuallyOrderedIndex ||
    left.difficulty - right.difficulty ||
    left.title.localeCompare(right.title)
  );
}

function sharedTagCount(left: Topic, right: Topic): number {
  return left.tags.filter((tag) => right.tags.includes(tag)).length;
}

export function sortTopicsByLearningOrder(topics: Topic[]): Topic[] {
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  const dependencies = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();

  for (const topic of topics) {
    const prerequisiteIds = inferEffectivePrerequisites(topic, topics).filter((dependencyId) => topicMap.has(dependencyId));
    dependencies.set(topic.id, new Set(prerequisiteIds));
    indegree.set(topic.id, prerequisiteIds.length);

    for (const dependencyId of prerequisiteIds) {
      const dependents = adjacency.get(dependencyId) ?? new Set<string>();
      dependents.add(topic.id);
      adjacency.set(dependencyId, dependents);
    }
  }

  const ready = topics.filter((topic) => (indegree.get(topic.id) ?? 0) === 0);
  const ordered: Topic[] = [];

  while (ready.length) {
    const recentTopics = ordered.slice(-2);
    const current = [...ready].sort((left, right) => {
      const lastTopic = recentTopics[recentTopics.length - 1];
      const leftUnlocks = adjacency.get(left.id)?.size ?? 0;
      const rightUnlocks = adjacency.get(right.id)?.size ?? 0;

      const score = (candidate: Topic): number => {
        let candidateScore = leftUnlocks;
        const unlocks = adjacency.get(candidate.id)?.size ?? 0;
        candidateScore = unlocks * 2 - candidate.difficulty;

        if (lastTopic) {
          const directDependency = dependencies.get(candidate.id)?.has(lastTopic.id) ?? false;

          if (directDependency) {
            candidateScore += 20;
          }

          const sameCategory = candidate.category === lastTopic.category;
          const sharedTags = sharedTagCount(candidate, lastTopic);

          if (sameCategory && !directDependency) {
            candidateScore -= 5;
          } else if (!sameCategory) {
            candidateScore += 5;
          }

          candidateScore += sharedTags * 2;

          const recentSameCategoryCount = recentTopics.filter((topic) => topic.category === candidate.category).length;

          if (recentSameCategoryCount > 0 && !directDependency) {
            candidateScore -= recentSameCategoryCount * 3;
          }
        }

        candidateScore -= candidate.manuallyOrderedIndex / 100;
        return candidateScore;
      };

      return score(right) - score(left) || compareTopicsByBaseOrder(left, right);
    })[0];

    if (!current) {
      break;
    }

    ordered.push(current);
    ready.splice(ready.findIndex((candidate) => candidate.id === current.id), 1);

    for (const dependentId of adjacency.get(current.id) ?? new Set<string>()) {
      const nextDegree = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, nextDegree);

      if (nextDegree === 0) {
        const dependent = topicMap.get(dependentId);

        if (dependent) {
          ready.push(dependent);
        }
      }
    }
  }

  if (ordered.length === topics.length) {
    return ordered;
  }

  const remaining = topics
    .filter((topic) => !ordered.some((orderedTopic) => orderedTopic.id === topic.id))
    .sort(compareTopicsByBaseOrder);

  return [...ordered, ...remaining];
}

export function selectVisibleTopics(topics: Topic[], count = 2): Topic[] {
  const ordered = sortTopicsByLearningOrder(topics);

  if (ordered.length <= count) {
    return ordered;
  }

  const selected = [ordered[0]];

  while (selected.length < count) {
    const lastSelected = selected[selected.length - 1];
    const remaining = ordered.filter((topic) => !selected.some((candidate) => candidate.id === topic.id));

    const next = [...remaining].sort((left, right) => {
      const score = (candidate: Topic): number => {
        const index = ordered.findIndex((topic) => topic.id === candidate.id);
        let candidateScore = 20 - index * 3;

        if (candidate.category !== lastSelected.category) {
          candidateScore += 10;
        } else {
          candidateScore -= 8;
        }

        const tagOverlap = sharedTagCount(candidate, lastSelected);
        candidateScore -= tagOverlap * 2;
        return candidateScore;
      };

      return score(right) - score(left) || compareTopicsByBaseOrder(left, right);
    })[0];

    if (!next) {
      break;
    }

    selected.push(next);
  }

  return selected;
}

export function prerequisitesSatisfied(
  topic: Topic,
  topics: Topic[],
  learnedIds: Set<string>,
  pickedIds = new Set<string>()
): boolean {
  const prerequisites = inferEffectivePrerequisites(topic, topics);

  return prerequisites.every((dependencyId) => learnedIds.has(dependencyId) || pickedIds.has(dependencyId));
}

export function scoreTopic(
  topic: Topic,
  topics: Topic[],
  lessons: LessonGeneration[],
  state: ExtensionState,
  dateKey: string,
  selectedTopicIds: string[]
): TopicScoreBreakdown {
  const rationale: string[] = [];
  let score = 0;

  if (topic.status === "paused") {
    return { topic, score: -1000, reviewCandidate: false, varietyPenalty: 0, rationale: ["Paused topic"] };
  }

  const latestLesson = getLatestLesson(lessons, topic.id);
  const todayHash = stableHash(`${dateKey}:${topic.id}`);
  const daysSinceShown = getDaysBetween(topic.lastShownAt, dateKey);
  const daysSinceLearned = getDaysBetween(topic.lastLearnedAt, dateKey);
  const reviewInterval = Math.max(4, Math.round(10 - state.settings.scheduling.reviewFrequency * 10));
  const reviewCandidate =
    topic.timesLearned > 0 && Number.isFinite(daysSinceLearned) && daysSinceLearned >= reviewInterval;

  if (topic.timesLearned === 0) {
    score += 28;
    rationale.push("Unseen topic bonus");
  } else if (reviewCandidate) {
    score += 22;
    rationale.push("Ready for spaced review");
  } else {
    score -= 10;
    rationale.push("Recently learned topics are deprioritized");
  }

  score += Math.max(0, 10 - topic.timesShown * 2);
  rationale.push("Freshness and limited exposure bonus");

  score += Math.max(0, 8 - topic.difficulty);
  rationale.push("Foundational difficulty weighting");

  if (daysSinceShown >= 4) {
    score += 6;
    rationale.push("Has not been shown recently");
  } else if (daysSinceShown <= 1) {
    score -= 18;
    rationale.push("Shown too recently");
  }

  if (latestLesson?.status === "not-now") {
    score += 8;
    rationale.push("Skipped topics should come back later");
  }

  if (latestLesson?.status === "continue-later") {
    score += 12;
    rationale.push("Continue-later topics need follow-up");
  }

  const selectedTopics = selectedTopicIds
    .map((id) => topics.find((candidate) => candidate.id === id))
    .filter((value): value is Topic => Boolean(value));

  const sameCategoryCount = selectedTopics.filter((candidate) => candidate.category === topic.category).length;
  const overlappingTags = selectedTopics.filter((candidate) =>
    candidate.tags.some((tag) => topic.tags.includes(tag))
  ).length;
  const varietyPenalty = sameCategoryCount * 9 + overlappingTags * 3;

  if (varietyPenalty > 0) {
    rationale.push("Variety penalty to avoid clustering similar topics");
  }

  score -= varietyPenalty;
  score += (todayHash % 5) / 10;

  return { topic, score, reviewCandidate, varietyPenalty, rationale };
}

function isReviewCandidate(topic: Topic, state: ExtensionState, dateKey: string): boolean {
  const daysSinceLearned = getDaysBetween(topic.lastLearnedAt, dateKey);
  const reviewInterval = Math.max(4, Math.round(10 - state.settings.scheduling.reviewFrequency * 10));

  return topic.timesLearned > 0 && Number.isFinite(daysSinceLearned) && daysSinceLearned >= reviewInterval;
}

export function selectDailyTopics(state: ExtensionState, dateKey: string): TopicScoreBreakdown[] {
  const topics = sortTopicsByLearningOrder([...state.topics]);
  const lessons = state.lessons;
  const learnedIds = new Set(
    topics.filter((topic) => topic.timesLearned > 0 || topic.status === "learned").map((topic) => topic.id)
  );
  const selected: TopicScoreBreakdown[] = [];
  const desiredCount = state.settings.scheduling.dailyTopicCount;

  while (selected.length < desiredCount) {
    const pickedIds = new Set(selected.map((candidate) => candidate.topic.id));
    const eligible = topics.filter(
      (topic) =>
        !pickedIds.has(topic.id) &&
        prerequisitesSatisfied(topic, topics, learnedIds, pickedIds) &&
        (topic.timesLearned === 0 || isReviewCandidate(topic, state, dateKey))
    );

    if (!eligible.length) {
      break;
    }

    const scored = eligible
      .map((topic) => scoreTopic(topic, topics, lessons, state, dateKey, selected.map((candidate) => candidate.topic.id)))
      .sort((left, right) => right.score - left.score);

    let winner = scored[0];
    const shouldBiasToReview =
      selected.length >= Math.max(1, desiredCount - 1) && !selected.some((candidate) => candidate.reviewCandidate);
    const reviewCandidate = scored.find((candidate) => candidate.reviewCandidate);

    if (
      shouldBiasToReview &&
      reviewCandidate &&
      winner &&
      reviewCandidate.score >= winner.score - 20
    ) {
      winner = reviewCandidate;
    }

    if (!winner || winner.score < -100) {
      break;
    }

    selected.push(winner);
  }

  return selected;
}

export function buildDailyPlan(state: ExtensionState, dateKey: string): DailyPlan {
  const selected = selectDailyTopics(state, dateKey);
  const now = new Date().toISOString();

  return {
    id: createId("plan"),
    dateKey,
    topicIds: selected.map((candidate) => candidate.topic.id),
    lessonIds: [],
    generatedAt: now,
    reasons: selected.map<PlanTopicReason>((candidate) => ({
      topicId: candidate.topic.id,
      score: Number(candidate.score.toFixed(2)),
      reviewCandidate: candidate.reviewCandidate,
      varietyPenalty: candidate.varietyPenalty,
      rationale: candidate.rationale
    }))
  };
}
