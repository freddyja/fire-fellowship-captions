import { escapeHtml } from "../dom";
import { hasTopicBody, localized } from "../topics";
import {
  LANG_LABEL,
  LANG_SHORT,
  langsForLayout,
  type CaptionLine,
  type Lang,
  type RoomState,
  type TopicContent,
} from "../types";

function lineClass(line: CaptionLine, index: number, total: number, allLines: CaptionLine[]): string {
  if (!line.isFinal) return "line interim";
  if (index === total - 1 || (index === total - 2 && !allLines[total - 1]?.isFinal)) return "line";
  return "line faded";
}

function renderWindow(lang: Lang, lines: CaptionLine[]): string {
  const visible = lines.filter((line) => line.text[lang]?.trim());
  const body =
    visible.length === 0
      ? `<p class="empty-caption">Waiting for live speech…</p>`
      : visible
          .map(
            (line, index) =>
              `<p class="${lineClass(line, index, visible.length, lines)}">${escapeHtml(line.text[lang])}</p>`,
          )
          .join("");
  return `
    <section class="window" data-lang="${lang}" lang="${lang}">
      <h2 class="window-label">${LANG_SHORT[lang]} · ${LANG_LABEL[lang]}</h2>
      <div class="lines">${body}</div>
    </section>
  `;
}

function renderTopicCard(topic: TopicContent, lang: Lang): string {
  const verse = localized(topic.verse, lang);
  const prompt = localized(topic.prompt, lang);
  return `
    <article class="tv-handout" lang="${lang}">
      <h3>${LANG_SHORT[lang]}</h3>
      ${verse ? `<p class="tv-verse">${escapeHtml(verse)}</p>` : `<p class="tv-verse muted">Verse can be added for this topic.</p>`}
      <p class="tv-prompt">${escapeHtml(prompt)}</p>
    </article>
  `;
}

function renderTopic(topic: TopicContent, langs: Lang[]): string {
  const title = localized(topic.title, langs[0] ?? "en");
  return `
    <div class="tv-topic-kicker">Topic of the day</div>
    <div class="tv-topic-head">
      <h2 class="tv-topic-title">${escapeHtml(title)}</h2>
      ${topic.reference ? `<p class="tv-topic-ref">${escapeHtml(topic.reference)}</p>` : ""}
    </div>
    <div class="tv-topic-grid" data-count="${langs.length}">
      ${langs.map((lang) => renderTopicCard(topic, lang)).join("")}
    </div>
  `;
}

export function paintCaptionBoard(
  board: HTMLElement,
  topicEl: HTMLElement,
  state: Pick<RoomState, "layout" | "lines" | "topic">,
): Lang[] {
  const langs = langsForLayout(state.layout);
  board.dataset.count = String(langs.length);
  board.dataset.layout = state.layout;
  board.innerHTML = langs.map((lang) => renderWindow(lang, state.lines)).join("");

  const topic = state.topic;
  if (hasTopicBody(topic) && topic) {
    topicEl.hidden = false;
    topicEl.dataset.count = String(langs.length);
    topicEl.innerHTML = renderTopic(topic, langs);
  } else {
    topicEl.hidden = true;
    topicEl.innerHTML = "";
  }
  return langs;
}
