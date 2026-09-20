import { escapeHtml } from "./dom";
import { localized } from "./topics";
import type { Lang, Localized, TopicContent } from "./types";

const QUESTIONS_HEADING: Localized = {
  en: "Discussion Questions:",
  es: "Preguntas para conversar:",
  pt: "Perguntas para conversa:",
};

export function renderInlineEmphasis(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderBodyHtml(body: string): string {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${renderInlineEmphasis(block.replace(/\s*\n\s*/g, " "))}</p>`)
    .join("");
}

export function discussionItems(topic: TopicContent, lang: Lang): string[] {
  const fromList = (topic.discussionQuestions ?? [])
    .map((item) => localized(item, lang))
    .filter(Boolean);
  if (fromList.length) return fromList;
  const prompt = localized(topic.prompt, lang);
  return prompt ? [prompt] : [];
}

export function renderTopicHandout(topic: TopicContent, lang: Lang): string {
  const verse = localized(topic.verse, lang);
  const hook = localized(topic.hook, lang);
  const body = localized(topic.body, lang);
  const questions = discussionItems(topic, lang);
  const reference = topic.reference?.trim() ?? "";
  const title = localized(topic.title, lang);

  const parts: string[] = [];

  if (reference) {
    parts.push(`<p class="topic-handout-ref">${escapeHtml(reference)}</p>`);
  } else if (title) {
    parts.push(`<p class="topic-handout-ref">${escapeHtml(title)}</p>`);
  }

  if (verse) {
    parts.push(`<blockquote class="topic-handout-verse">${escapeHtml(`“${verse}”`)}</blockquote>`);
  }

  if (hook) {
    parts.push(`<p class="topic-handout-hook">${renderInlineEmphasis(hook)}</p>`);
  }

  if (body) {
    parts.push(`<div class="topic-handout-body">${renderBodyHtml(body)}</div>`);
  }

  if (questions.length) {
    parts.push(`
      <p class="topic-handout-qhead">${escapeHtml(localized(QUESTIONS_HEADING, lang))}</p>
      <ol class="topic-handout-questions">
        ${questions.map((item) => `<li>${renderInlineEmphasis(item)}</li>`).join("")}
      </ol>
    `);
  }

  return `<div class="topic-handout" lang="${lang}">${parts.join("")}</div>`;
}
