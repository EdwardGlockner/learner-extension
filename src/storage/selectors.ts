import type { ExtensionState, Topic } from "../shared/types";

export function getTopicById(state: ExtensionState, topicId: string): Topic | undefined {
  return state.topics.find((topic) => topic.id === topicId);
}
