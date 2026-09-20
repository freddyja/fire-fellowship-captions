import { finalizedLines } from "../caption-history";
import { escapeHtml } from "../dom";
import { renderTopicHandout } from "../topic-layout";
import { hasTopicBody, localized } from "../topics";
import {
  LANG_LABEL,
  LANG_SHORT,
  langsForLayout,
  TOPIC_SHEET_LANGS,
  type CaptionLine,
  type Lang,
  type RoomState,
  type TopicContent,
} from "../types";

export type LiveCaption = {
  text: string;
  sourceLang: Lang;
};

function lineClass(index: number, total: number, hasLive: boolean): string {
  if (index === total - 1 && !hasLive) return "line";
  return "line faded";
}

function renderWindow(lang: Lang, lines: CaptionLine[], live?: LiveCaption | null): string {
  const visible = finalizedLines(lines).filter((line) => line.text[lang]?.trim());
  const liveText = live?.text.trim() ?? "";
  const history =
    visible.length === 0
      ? ""
      : visible
          .map(
            (line, index) =>
              `<p class="${lineClass(index, visible.length, Boolean(liveText))}">${escapeHtml(line.text[lang])}</p>`,
          )
          .join("");
  let extra = "";
  if (liveText) {
    const draft = lang === live?.sourceLang ? liveText : "Listening…";
    extra = `<p class="line interim">${escapeHtml(draft)}</p>`;
  } else if (visible.length === 0) {
    extra = `<p class="empty-caption">Waiting for live speech…</p>`;
  }
  return `
    <section class="window" data-lang="${lang}" lang="${lang}">
      <h2 class="window-label">${LANG_SHORT[lang]} · ${LANG_LABEL[lang]}</h2>
      <div class="lines">${history}${extra}</div>
    </section>
  `;
}

const MISSING_VERSE: Record<Lang, string> = {
  en: "Verse can be added for this topic.",
  es: "Se puede añadir el versículo para este tema.",
  pt: "O versículo pode ser acrescentado a este tema.",
};

function renderTopicCard(topic: TopicContent, lang: Lang): string {
  const verse = localized(topic.verse, lang);
  return `
    <article class="tv-handout" lang="${lang}">
      <h3>${LANG_SHORT[lang]} · ${LANG_LABEL[lang]}</h3>
      ${renderTopicHandout(topic, lang)}
      ${!verse ? `<p class="tv-verse muted">${escapeHtml(MISSING_VERSE[lang])}</p>` : ""}
    </article>
  `;
}

function renderTopic(topic: TopicContent): string {
  const title = localized(topic.title, "en");
  return `
    <div class="tv-topic-kicker">Topic of the day${title ? ` · ${escapeHtml(title)}` : ""} · EN | ES | PT</div>
    <div class="tv-topic-grid" data-count="${TOPIC_SHEET_LANGS.length}">
      ${TOPIC_SHEET_LANGS.map((lang) => renderTopicCard(topic, lang)).join("")}
    </div>
  `;
}

export function paintCaptionBoard(
  board: HTMLElement,
  topicEl: HTMLElement,
  state: Pick<RoomState, "layout" | "lines" | "topic">,
  live?: LiveCaption | null,
): Lang[] {
  const langs = langsForLayout(state.layout);
  board.dataset.count = String(langs.length);
  board.dataset.layout = state.layout;
  board.innerHTML = langs.map((lang) => renderWindow(lang, state.lines, live)).join("");

  const topic = state.topic;
  if (hasTopicBody(topic) && topic) {
    topicEl.hidden = false;
    topicEl.dataset.count = String(TOPIC_SHEET_LANGS.length);
    topicEl.innerHTML = renderTopic(topic);
  } else {
    topicEl.hidden = true;
    topicEl.innerHTML = "";
  }
  return langs;
}
