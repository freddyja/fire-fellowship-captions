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

/** Pane-language placeholders, so a Spanish pane never shows English chrome. */
const PANE_COPY: Record<"waiting" | "listening" | "translating", Record<Lang, string>> = {
  waiting: { en: "Waiting for live speech…", es: "Esperando la voz en vivo…", pt: "Aguardando a fala ao vivo…" },
  listening: { en: "Listening…", es: "Escuchando…", pt: "Ouvindo…" },
  translating: { en: "translating…", es: "traduciendo…", pt: "traduzindo…" },
};

function speakerMarkup(name: string): string {
  const label = name.trim();
  if (!label) return "";
  return `<span class="line-speaker" data-speaker="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
}

/**
 * Which lines get a speaker label. One speaker all evening (usually "Host")
 * gets none; with several, a name shows only where the speaker changes.
 */
export function speakerLabels(names: string[]): string[] {
  const trimmed = names.map((name) => name.trim());
  const distinct = new Set(trimmed.filter(Boolean));
  if (distinct.size <= 1) return trimmed.map(() => "");
  let previous = "";
  return trimmed.map((name) => {
    if (!name) return "";
    const show = name !== previous;
    previous = name;
    return show ? name : "";
  });
}

/** True when this line has words for the pane, or is still being translated into it. */
export function lineShowsIn(line: CaptionLine, lang: Lang): boolean {
  return Boolean(line.text[lang]?.trim()) || Boolean(line.pending);
}

function renderWindow(
  lang: Lang,
  lines: CaptionLine[],
  live: LiveCaption | null | undefined,
  activeSpeaker: string,
): string {
  const all = finalizedLines(lines);
  const liveText = live?.text.trim() ?? "";
  // Names come from every line (not just this pane), so all panes agree on labels.
  const names = all.map((line, index) => {
    const latest = index === all.length - 1;
    return (line.speaker ?? "").trim() || (latest && !liveText ? activeSpeaker : "");
  });
  if (liveText) names.push((live?.speaker ?? "").trim() || activeSpeaker);
  const labels = speakerLabels(names);
  const shown = all
    .map((line, index) => ({ line, label: labels[index] ?? "" }))
    .filter(({ line }) => lineShowsIn(line, lang));
  const history = shown
    .map(({ line, label }, index) => {
      const words = line.text[lang]?.trim();
      const cls = lineClass(index, shown.length, Boolean(liveText));
      if (!words) {
        return `<p class="${cls} pending">${speakerMarkup(label)}<span class="line-text">${escapeHtml(PANE_COPY.translating[lang])}</span></p>`;
      }
      return `<p class="${cls}">${speakerMarkup(label)}<span class="line-text">${escapeHtml(words)}</span></p>`;
    })
    .join("");
  let extra = "";
  if (liveText) {
    const draft = lang === live?.sourceLang ? liveText : PANE_COPY.listening[lang];
    const label = labels[labels.length - 1] ?? "";
    extra = `<p class="line interim">${speakerMarkup(label)}<span class="line-text">${escapeHtml(draft)}</span></p>`;
  } else if (shown.length === 0) {
    extra = `<p class="empty-caption">${escapeHtml(PANE_COPY.waiting[lang])}</p>`;
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

/** A pane within this many px of the bottom counts as "following the latest line". */
const PIN_SLACK_PX = 24;

const lastBoardHtml = new WeakMap<HTMLElement, string>();

type PaneScroll = { top: number; pinned: boolean };

function readPaneScroll(board: HTMLElement): Map<string, PaneScroll> {
  const out = new Map<string, PaneScroll>();
  for (const pane of board.querySelectorAll<HTMLElement>(".window[data-lang] > .lines")) {
    const lang = (pane.parentElement as HTMLElement | null)?.dataset.lang;
    if (!lang) continue;
    const gap = pane.scrollHeight - pane.scrollTop - pane.clientHeight;
    out.set(lang, { top: pane.scrollTop, pinned: gap <= PIN_SLACK_PX });
  }
  return out;
}

/**
 * Caption panes follow the newest line, unless the reader scrolled up to
 * re-read something — then their position is kept until they scroll back down.
 */
function restorePaneScroll(board: HTMLElement, prior: Map<string, PaneScroll>) {
  for (const pane of board.querySelectorAll<HTMLElement>(".window[data-lang] > .lines")) {
    const lang = (pane.parentElement as HTMLElement | null)?.dataset.lang ?? "";
    const before = prior.get(lang);
    const follow = !before || before.pinned;
    pane.scrollTop = follow ? pane.scrollHeight : before.top;
    // Reader scrolled up and new lines arrived below: offer a jump back down.
    if (!follow && pane.scrollHeight - pane.scrollTop - pane.clientHeight > PIN_SLACK_PX) {
      addNewCaptionsPill(pane);
    }
  }
}

function addNewCaptionsPill(pane: HTMLElement) {
  const win = pane.parentElement;
  if (!win || win.querySelector(".new-captions-pill")) return;
  const pill = document.createElement("button");
  pill.type = "button";
  pill.className = "new-captions-pill";
  pill.textContent = "New captions ↓";
  const drop = () => {
    pill.remove();
    pane.removeEventListener("scroll", onScroll);
  };
  const onScroll = () => {
    if (pane.scrollHeight - pane.scrollTop - pane.clientHeight <= PIN_SLACK_PX) drop();
  };
  pill.addEventListener("click", () => {
    pane.scrollTop = pane.scrollHeight;
    drop();
  });
  pane.addEventListener("scroll", onScroll, { passive: true });
  win.appendChild(pill);
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
  const html = langs.map((lang) => renderWindow(lang, state.lines, live, activeSpeaker)).join("");
  // Unchanged captions: leave the DOM alone so a finger mid-scroll is not interrupted.
  if (lastBoardHtml.get(board) !== html || !board.firstElementChild) {
    const prior = readPaneScroll(board);
    board.innerHTML = html;
    lastBoardHtml.set(board, html);
    restorePaneScroll(board, prior);
  }

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
