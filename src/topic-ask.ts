import { normalizeTopic } from "./topics";
import type { TopicContent } from "./types";

export async function requestTopicHandout(query: string, signal?: AbortSignal): Promise<TopicContent> {
  const res = await fetch("/api/topic-handout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  const payload = (await res.json().catch(() => ({}))) as { topic?: TopicContent; error?: string };
  if (!res.ok) {
    throw new Error(payload.error || "Could not write that handout.");
  }
  const topic = normalizeTopic(payload.topic);
  if (!topic?.reference || !topic.verse.en) {
    throw new Error("Could not write that handout.");
  }
  return topic;
}
