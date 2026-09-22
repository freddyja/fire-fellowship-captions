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
  type FloorState,
  type Lang,
  type RoomState,
  type TopicContent,
} from "../types";

export type LiveCaption = {
  text: string;
  sourceLang: Lang;
  speaker?: string;
};

function lineClass(index: number, total: number, hasLive: boolean): string {
  if (index === total - 1 && !hasLive) return "line";
  return "line faded";
}

function speakerMarkup(name: string): string {
  const label = name.trim();
  if (!label) return "";
  return `<span class="line-speaker" data-speaker="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
}

function renderWindow(
  lang: Lang,
  lines: CaptionLine[],
  live: LiveCaption | null | undefined,
  activeSpeaker: string,
): string {
  const visible = finalizedLines(lines).filter((line) => line.text[lang]?.trim());
  const liveText = live?.text.trim() ?? "";
  const history =
    visible.length === 0
      ? ""
      : visible
          .map((line, index) => {
            const latest = index === visible.length - 1;
            const named = (line.speaker ?? "").trim() || (latest && !liveText ? activeSpeaker : "");
            return `<p class="${lineClass(index, visible.length, Boolean(liveText))}">${speakerMarkup(named)}<span class="line-text">${escapeHtml(line.text[lang])}</span></p>`;
          })
          .join("");
  let extra = "";
  if (liveText) {
    const draft = lang === live?.sourceLang ? liveText : "Listening…";
    const named = (live?.speaker ?? "").trim() || activeSpeaker;
    extra = `<p class="line interim">${speakerMarkup(named)}<span class="line-text">${escapeHtml(draft)}</span></p>`;
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
  const handout = renderTopicHandout(topic, lang);
  const empty =
    !verse &&
    !localized(topic.hook, lang) &&
    !localized(topic.body, lang) &&
    !localized(topic.title, lang) &&
    !topic.reference?.trim();
  return `
    <article class="tv-handout" lang="${lang}">
      <h3>${LANG_SHORT[lang]} · ${LANG_LABEL[lang]}</h3>
      ${empty ? renderTopicHandout(topic, "en") : handout}
      ${!verse && !localized(topic.verse, "en") ? `<p class="tv-verse muted">${escapeHtml(MISSING_VERSE[lang])}</p>` : ""}
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

function activeSpeakerName(floor: FloorState | null | undefined): string {
  return floor?.holderName?.trim() ?? "";
}

export function paintCaptionBoard(
  board: HTMLElement,
  topicEl: HTMLElement,
  state: Pick<RoomState, "layout" | "lines" | "topic"> & { floor?: FloorState | null },
  live?: LiveCaption | null,
): Lang[] {
  const langs = langsForLayout(state.layout);
  const activeSpeaker = activeSpeakerName(state.floor);
  board.dataset.count = String(langs.length);
  board.dataset.layout = state.layout;
  board.innerHTML = langs.map((lang) => renderWindow(lang, state.lines, live, activeSpeaker)).join("");

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
