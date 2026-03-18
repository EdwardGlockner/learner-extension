import type { LessonGeneration, PlanTopicReason, Topic } from "../../shared/types";

type LessonCardProps = {
  topic: Topic;
  lesson: LessonGeneration;
  reason?: PlanTopicReason;
  onStatusChange: (lessonId: string, status: LessonGeneration["status"]) => Promise<void>;
  onRegenerate: (topicId: string) => Promise<void>;
};

export function LessonCard({ topic, lesson, reason, onStatusChange, onRegenerate }: LessonCardProps) {
  return (
    <article className="lesson-card">
      <div className="lesson-card-header">
        <div>
          <p className="eyebrow">{topic.category.replaceAll("-", " ")}</p>
          <h3>{topic.title}</h3>
        </div>
        <div className="pill-row">
          <span className="pill">Difficulty {topic.difficulty}</span>
          <span className="pill">{lesson.providerId === "offline-preview" ? "Preview" : lesson.model}</span>
        </div>
      </div>

      {reason ? (
        <div className="reason-box">
          <strong>Why today:</strong> {reason.rationale.join(" • ")}
        </div>
      ) : null}

      <div className="lesson-scroll">
        <section>
          <h4>Explanation</h4>
          <p>{lesson.content.explanation}</p>
        </section>
        <section>
          <h4>Why it matters</h4>
          <p>{lesson.content.whyItMatters}</p>
        </section>
        <section>
          <h4>Examples</h4>
          <ul className="plain-list">
            {lesson.content.examples.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4>Common confusion</h4>
          <ul className="plain-list">
            {lesson.content.pitfalls.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4>What to learn next</h4>
          <ul className="plain-list">
            {lesson.content.nextSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        {lesson.content.resources.length ? (
          <section>
            <h4>Deep dive</h4>
            <ul className="resource-list">
              {lesson.content.resources.map((resource) => (
                <li key={`${resource.title}-${resource.url}`}>
                  <a href={resource.url} target="_blank" rel="noreferrer">
                    {resource.title}
                  </a>
                  {resource.source ? <span>{resource.source}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="lesson-actions">
        <button className="button button-primary" onClick={() => void onStatusChange(lesson.id, "learned")}>
          Mark as learned
        </button>
        <button className="button" onClick={() => void onStatusChange(lesson.id, "continue-later")}>
          Continue later
        </button>
        <button className="button button-ghost" onClick={() => void onStatusChange(lesson.id, "not-now")}>
          Not now
        </button>
        <button className="button button-ghost" onClick={() => void onRegenerate(topic.id)}>
          Regenerate
        </button>
      </div>
    </article>
  );
}
