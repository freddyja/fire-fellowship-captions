import { brandBlock } from "../brand";
import { connectRoom, type RoomConnection } from "../realtime/client";
import { goto, tvUrl } from "../router";
import { createWebSpeechProvider } from "../stt/web-speech";
import { createTranslator, translateAll } from "../translate";
import {
  emptyState,
  LANG_LABEL,
  LANG_SHORT,
  LANGS,
  LAYOUTS,
  MAX_LINES,
  speechLocale,
  type CaptionLine,
  type ConnStatus,
  type Lang,
  type Layout,
  type PeerCounts,
  type RoomState,
} from "../types";

const INTERIM_ID = "interim";
const micIcon = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
  <rect x="9" y="3" width="6" height="11" rx="3"/>
  <path d="M6 11a6 6 0 0 0 12 0"/>
  <path d="M12 17v4M8 21h8"/>
</svg>
`;

export function mountPhone(root: HTMLElement, room: string): () => void {
  const translator = createTranslator();
  const speech = createWebSpeechProvider();
  let state = emptyState(room);
  let peers: PeerCounts = { phones: 1, tvs: 0 };
  let connStatus: ConnStatus = "connecting";
  let error = "";
  let conn: RoomConnection | null = null;
  let interimTimer = 0;
  let seq = 0;
  let hydrated = false;

  const push = () => conn?.push(state);

  const setState = (next: RoomState, sync = true) => {
    state = next;
    renderDynamic();
    if (sync) push();
  };

  root.innerHTML = `
    <section class="screen phone-screen">
      <div class="phone-top">
        ${brandBlock()}
        <div class="phone-status">
          <div class="room-pill">Room <strong data-room></strong></div>
          <div class="status-pill"><span class="dot" data-dot></span><span data-status></span></div>
        </div>
      </div>

      <div class="mic-wrap">
        <button class="mic" data-mic type="button" aria-pressed="false">
          ${micIcon}
          <small data-mic-label>Start</small>
        </button>
        <p class="hint" data-error></p>
      </div>

      <div class="controls">
        <div>
          <p class="control-label">Spoken language</p>
          <div class="chips" data-source></div>
        </div>
        <div>
          <p class="control-label">TV layout</p>
          <div class="chips" data-layouts></div>
        </div>
        <div class="preview">
          <p class="control-label">On this phone</p>
          <p data-preview></p>
        </div>
        <div class="row-actions">
          <button class="ghost" data-open-tv type="button">Open TV view</button>
          <button class="ghost" data-copy type="button">Copy TV link</button>
          <button class="ghost" data-clear type="button">Clear windows</button>
          <button class="ghost" data-home type="button">Leave</button>
        </div>
        <form class="typed-caption" data-type>
          <input name="caption" autocomplete="off" placeholder="Or type a caption" />
          <button class="primary" type="submit">Send</button>
        </form>
      </div>
    </section>
  `;

  const sourceBox = root.querySelector("[data-source]") as HTMLElement;
  const layoutBox = root.querySelector("[data-layouts]") as HTMLElement;
  sourceBox.innerHTML = LANGS.map(
    (lang) => `<button class="chip" type="button" data-lang="${lang}">${LANG_SHORT[lang]} ${LANG_LABEL[lang]}</button>`,
  ).join("");
  layoutBox.innerHTML = LAYOUTS.map(
    (item) => `<button class="chip" type="button" data-layout="${item.id}">${item.label}</button>`,
  ).join("");

  const typeForm = root.querySelector("[data-type]") as HTMLFormElement;


  const els = {
    room: root.querySelector("[data-room]") as HTMLElement,
    status: root.querySelector("[data-status]") as HTMLElement,
    dot: root.querySelector("[data-dot]") as HTMLElement,
    mic: root.querySelector("[data-mic]") as HTMLButtonElement,
    micLabel: root.querySelector("[data-mic-label]") as HTMLElement,
    error: root.querySelector("[data-error]") as HTMLElement,
    preview: root.querySelector("[data-preview]") as HTMLElement,
  };

  function renderDynamic() {
    els.room.textContent = state.room;
    const tvNote = peers.tvs > 0 ? `TV connected (${peers.tvs})` : "Waiting for TV";
    const connNote = connStatus === "live" ? tvNote : connStatus === "connecting" ? "Connecting…" : "Reconnecting…";
    els.status.textContent = state.listening ? `Listening · ${connNote}` : connNote;
    els.dot.className = `dot ${state.listening ? "listening" : connStatus === "live" ? "live" : "offline"}`;
    els.mic.classList.toggle("hot", state.listening);
    els.mic.setAttribute("aria-pressed", String(state.listening));
    els.micLabel.textContent = state.listening ? "Stop" : "Start";
    els.error.textContent = error;
    const last = state.lines.at(-1);
    els.preview.textContent = last?.text[state.sourceLang] || "Captions will appear here and on the TV.";
    els.preview.classList.toggle("interim", Boolean(last && !last.isFinal));

    for (const btn of sourceBox.querySelectorAll<HTMLButtonElement>("[data-lang]")) {
      btn.classList.toggle("active", btn.dataset.lang === state.sourceLang);
    }
    for (const btn of layoutBox.querySelectorAll<HTMLButtonElement>("[data-layout]")) {
      btn.classList.toggle("active", btn.dataset.layout === state.layout);
    }
  }

  async function publish(text: string, isFinal: boolean) {
    const token = ++seq;
    const translated = await translateAll(translator, text, state.sourceLang);
    if (token !== seq && !isFinal) return;
    const line: CaptionLine = {
      id: isFinal ? crypto.randomUUID() : INTERIM_ID,
      isFinal,
      text: translated,
      at: Date.now(),
    };
    const lines = state.lines.filter((item) => item.id !== INTERIM_ID);
    if (isFinal) lines.push(line);
    else lines.push(line);
    setState({ ...state, lines: lines.slice(-MAX_LINES) });
  }

  const onMic = () => {
    error = "";
    if (state.listening) {
      speech.stop();
      setState({ ...state, listening: false });
      return;
    }
    speech.setLang(speechLocale(state.sourceLang));
    speech.start();
    setState({ ...state, listening: true });
  };

  speech.onResult = (result) => {
    error = "";
    window.clearTimeout(interimTimer);
    if (result.isFinal) {
      void publish(result.text, true);
      return;
    }
    interimTimer = window.setTimeout(() => {
      void publish(result.text, false);
    }, 160);
  };
  speech.onError = (message) => {
    error = message;
    if (message.includes("Microphone blocked") || message.includes("no Web Speech")) {
      speech.stop();
      typeForm.hidden = false;
      setState({ ...state, listening: false });
      return;
    }
    renderDynamic();
  };

  const onSource = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-lang]");
    if (!btn?.dataset.lang) return;
    const sourceLang = btn.dataset.lang as Lang;
    speech.setLang(speechLocale(sourceLang));
    setState({ ...state, sourceLang });
  };

  const onLayout = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-layout]");
    if (!btn?.dataset.layout) return;
    setState({ ...state, layout: btn.dataset.layout as Layout });
  };

  const onOpenTv = () => window.open(tvUrl(room), "ff-tv", "noopener");
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(tvUrl(room));
      error = "TV link copied.";
      renderDynamic();
    } catch {
      error = tvUrl(room);
      renderDynamic();
    }
  };
  const onClear = () => setState({ ...state, lines: [] });
  const onHome = () => {
    speech.stop();
    goto("home");
  };
  const onType = (event: Event) => {
    event.preventDefault();
    const input = typeForm.elements.namedItem("caption") as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    void publish(text, true);
  };

  els.mic.addEventListener("click", onMic);
  sourceBox.addEventListener("click", onSource);
  layoutBox.addEventListener("click", onLayout);
  root.querySelector("[data-open-tv]")?.addEventListener("click", onOpenTv);
  root.querySelector("[data-copy]")?.addEventListener("click", onCopy);
  root.querySelector("[data-clear]")?.addEventListener("click", onClear);
  root.querySelector("[data-home]")?.addEventListener("click", onHome);
  typeForm.addEventListener("submit", onType);

  conn = connectRoom({
    room,
    role: "phone",
    onState(next) {
      if (hydrated) return;
      hydrated = true;
      state = { ...next, room, listening: false };
      speech.setLang(speechLocale(state.sourceLang));
      renderDynamic();
      push();
    },
    onPeers(next) {
      peers = next;
      renderDynamic();
    },
    onStatus(status) {
      connStatus = status;
      renderDynamic();
    },
  });

  renderDynamic();

  return () => {
    speech.stop();
    conn?.close();
    window.clearTimeout(interimTimer);
    els.mic.removeEventListener("click", onMic);
    sourceBox.removeEventListener("click", onSource);
    layoutBox.removeEventListener("click", onLayout);
    typeForm.removeEventListener("submit", onType);
  };
}
