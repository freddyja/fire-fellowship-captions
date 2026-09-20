import { brandBlock } from "../brand";
import { appendFinalLine, applyFinalLine, finalizedLines } from "../caption-history";
import { escapeHtml } from "../dom";
import { tvQrSvg } from "../qr";
import { connectRoom, type RoomConnection } from "../realtime/client";
import { goto, tvUrl } from "../router";
import { createWebSpeechProvider } from "../stt/web-speech";
import { renderTopicHandout } from "../topic-layout";
import { hasTopicBody, localized, normalizeTopic, resolveTopic, TOPIC_LIST } from "../topics";
import { createTranslator, translateAll } from "../translate";
import { paintCaptionBoard } from "./caption-board";
import {
  emptyState,
  LANG_LABEL,
  LANG_SHORT,
  LANGS,
  LAYOUTS,
  speechLocale,
  type CaptionLine,
  type ConnStatus,
  type Lang,
  type Layout,
  type PeerCounts,
  type RoomState,
  type TopicContent,
} from "../types";

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
  let publishEpoch = 0;
  let hydrated = false;
  let wakeLock: WakeLockSentinel | null = null;
  let copyLabelTimer = 0;
  let smartViewMode = false;
  let liveInterim = "";

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

      <div class="phone-body">
        <div class="phone-main">
          <div class="controls topic-controls">
            <div>
              <p class="control-label">Topic of the day <button class="ghost topic-clear" data-clear-topic type="button">Clear</button></p>
              <div class="chips" data-topics></div>
              <form class="topic-insert" data-topic-form>
                <input name="topic" autocomplete="off" enterkeyhint="search" placeholder="Insert or search a topic or verse" />
                <button class="secondary" type="submit">Set</button>
              </form>
              <div class="topic-preview" data-topic-preview></div>
            </div>
          </div>
        </div>

        <div class="phone-side">
          <div class="mic-wrap">
            <button class="mic" data-mic type="button" aria-pressed="false">
              ${micIcon}
              <small data-mic-label>Start</small>
            </button>
            <p class="hint" data-error></p>
            <p class="hint mic-chrome-hint">Keep Chrome in the foreground while you speak.</p>
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
            <div class="row-actions tv-path-actions">
              <button class="primary send-tv-btn" data-send-tv type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="send-tv-dialog" aria-label="Send to TV — show QR and TV caption link">
                Send to TV
              </button>
              <button class="secondary smart-view-btn" data-smart-view-mode type="button" aria-pressed="false" aria-label="Smart View mode — show caption layout for system mirroring">
                Smart View mode
              </button>
            </div>
            <div class="row-actions">
              <button class="ghost" data-clear type="button">Clear windows</button>
              <button class="ghost" data-home type="button">Leave</button>
            </div>
            <form class="typed-caption" data-type>
              <input name="caption" autocomplete="off" enterkeyhint="send" placeholder="Or type a caption" />
              <button class="primary" type="submit">Send</button>
            </form>
          </div>
        </div>
      </div>

      <dialog class="send-tv-dialog" id="send-tv-dialog" data-send-tv-dialog aria-labelledby="send-tv-title">
        <div class="send-tv-sheet">
          <header class="send-tv-head">
            <h2 id="send-tv-title">Send to TV</h2>
            <button class="ghost send-tv-close" data-send-tv-close type="button">Close</button>
          </header>
          <div class="send-tv-qr" data-send-tv-qr></div>
          <p class="send-tv-url" data-send-tv-url></p>
          <button class="primary send-tv-copy" data-copy type="button">Copy TV link</button>
          <ol class="send-tv-steps">
            <li>On the TV browser, open this link or scan the QR.</li>
            <li>Keep the Fold on the mic page.</li>
          </ol>
          <button class="ghost send-tv-open" data-open-tv type="button" aria-label="Open TV view on this device for testing">
            Open TV view
          </button>
        </div>
      </dialog>

      <div class="smart-view-layer" data-smart-view-layer hidden>
        <section class="screen tv-screen smart-view-captions">
          <div class="tv-top">
            ${brandBlock(true)}
            <div class="tv-meta">
              <div class="room-pill">Room <strong data-sv-room></strong></div>
              <div class="status-pill"><span class="dot" data-sv-dot></span><span data-sv-status></span></div>
            </div>
          </div>
          <aside class="tv-topic" data-sv-topic hidden></aside>
          <main class="tv-board" data-sv-board></main>
          <div class="smart-view-dock">
            <p class="smart-view-tip">Now open system Smart View → My TV. TV will mirror these captions.</p>
            <div class="smart-view-controls">
              <button class="smart-view-mic" data-smart-mic type="button" aria-pressed="false">
                ${micIcon}
                <small data-smart-mic-label>Start</small>
              </button>
              <button class="secondary" data-exit-smart-view type="button">Exit Smart View mode</button>
            </div>
          </div>
        </section>
      </div>
    </section>
  `;

  const sourceBox = root.querySelector("[data-source]") as HTMLElement;
  const layoutBox = root.querySelector("[data-layouts]") as HTMLElement;
  const topicBox = root.querySelector("[data-topics]") as HTMLElement;
  const topicForm = root.querySelector("[data-topic-form]") as HTMLFormElement;
  const topicPreview = root.querySelector("[data-topic-preview]") as HTMLElement;
  sourceBox.innerHTML = LANGS.map(
    (lang) => `<button class="chip" type="button" data-lang="${lang}">${LANG_SHORT[lang]} ${LANG_LABEL[lang]}</button>`,
  ).join("");
  layoutBox.innerHTML = LAYOUTS.map(
    (item) => `<button class="chip" type="button" data-layout="${item.id}">${item.label}</button>`,
  ).join("");
  topicBox.innerHTML = TOPIC_LIST.map(
    (topic) =>
      `<button class="chip" type="button" data-topic="${topic.id}">${escapeHtml(topic.title.en)}</button>`,
  ).join("");

  const typeForm = root.querySelector("[data-type]") as HTMLFormElement;
  const sendBtn = root.querySelector("[data-send-tv]") as HTMLButtonElement;
  const sendDialog = root.querySelector("[data-send-tv-dialog]") as HTMLDialogElement;
  const qrBox = root.querySelector("[data-send-tv-qr]") as HTMLElement;
  const urlEl = root.querySelector("[data-send-tv-url]") as HTMLElement;
  const copyBtn = root.querySelector("[data-copy]") as HTMLButtonElement;
  const screen = root.querySelector(".phone-screen") as HTMLElement;
  const smartLayer = root.querySelector("[data-smart-view-layer]") as HTMLElement;
  const smartEnter = root.querySelector("[data-smart-view-mode]") as HTMLButtonElement;
  const smartExit = root.querySelector("[data-exit-smart-view]") as HTMLButtonElement;
  const smartMic = root.querySelector("[data-smart-mic]") as HTMLButtonElement;
  const svBoard = root.querySelector("[data-sv-board]") as HTMLElement;
  const svTopic = root.querySelector("[data-sv-topic]") as HTMLElement;

  const els = {
    room: root.querySelector("[data-room]") as HTMLElement,
    status: root.querySelector("[data-status]") as HTMLElement,
    dot: root.querySelector("[data-dot]") as HTMLElement,
    mic: root.querySelector("[data-mic]") as HTMLButtonElement,
    micLabel: root.querySelector("[data-mic-label]") as HTMLElement,
    error: root.querySelector("[data-error]") as HTMLElement,
    preview: root.querySelector("[data-preview]") as HTMLElement,
    topicInput: topicForm.elements.namedItem("topic") as HTMLInputElement,
    svRoom: root.querySelector("[data-sv-room]") as HTMLElement,
    svStatus: root.querySelector("[data-sv-status]") as HTMLElement,
    svDot: root.querySelector("[data-sv-dot]") as HTMLElement,
    smartMicLabel: root.querySelector("[data-smart-mic-label]") as HTMLElement,
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
    const lastFinal = finalizedLines(state.lines).at(-1);
    if (liveInterim) {
      els.preview.textContent = liveInterim;
    } else if (state.listening) {
      els.preview.textContent = lastFinal?.text[state.sourceLang] || "Listening…";
    } else {
      els.preview.textContent = lastFinal?.text[state.sourceLang] || "Captions will appear here and on the TV.";
    }
    els.preview.classList.toggle("interim", Boolean(liveInterim) || (state.listening && !lastFinal));

    screen.classList.toggle("is-smart-view", smartViewMode);
    smartLayer.hidden = !smartViewMode;
    smartEnter.setAttribute("aria-pressed", String(smartViewMode));
    smartMic.classList.toggle("hot", state.listening);
    smartMic.setAttribute("aria-pressed", String(state.listening));
    els.smartMicLabel.textContent = state.listening ? "Stop" : "Start";
    els.svRoom.textContent = state.room;
    const svNote = state.listening ? "Listening · Smart View mode" : "Smart View mode";
    els.svStatus.textContent = svNote;
    els.svDot.className = `dot ${state.listening ? "listening" : connStatus === "live" ? "live" : "offline"}`;
    if (smartViewMode) {
      paintCaptionBoard(
        svBoard,
        svTopic,
        { ...state, lines: finalizedLines(state.lines) },
        liveInterim ? { text: liveInterim, sourceLang: state.sourceLang } : null,
      );
    }

    for (const btn of sourceBox.querySelectorAll<HTMLButtonElement>("[data-lang]")) {
      btn.classList.toggle("active", btn.dataset.lang === state.sourceLang);
    }
    for (const btn of layoutBox.querySelectorAll<HTMLButtonElement>("[data-layout]")) {
      btn.classList.toggle("active", btn.dataset.layout === state.layout);
    }
    for (const btn of topicBox.querySelectorAll<HTMLButtonElement>("[data-topic]")) {
      btn.classList.toggle("active", state.topic?.id === btn.dataset.topic);
    }
    topicPreview.innerHTML = renderTopicPreview(state.topic, state.sourceLang);
  }

  function setLiveInterim(text: string) {
    const next = text.trim();
    if (next === liveInterim) return;
    liveInterim = next;
    renderDynamic();
  }

  async function publishFinal(text: string, coalesce = true) {
    const spoken = text.trim();
    if (!spoken) return;
    liveInterim = "";
    renderDynamic();
    const epoch = publishEpoch;
    const translated = await translateAll(translator, spoken, state.sourceLang);
    if (epoch !== publishEpoch) return;
    const line: CaptionLine = {
      id: crypto.randomUUID(),
      isFinal: true,
      text: translated,
      at: Date.now(),
    };
    const lines = coalesce
      ? applyFinalLine(state.lines, line, state.sourceLang)
      : appendFinalLine(state.lines, line);
    setState({ ...state, lines });
  }

  const releaseWake = () => {
    void wakeLock?.release();
    wakeLock = null;
  };

  const requestWake = async () => {
    try {
      wakeLock = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      /* Chrome may deny if the tab is in the background */
    }
  };

  const onMic = () => {
    error = "";
    if (state.listening) {
      speech.stop();
      releaseWake();
      liveInterim = "";
      setState({ ...state, listening: false });
      return;
    }
    speech.setLang(speechLocale(state.sourceLang));
    speech.start();
    void requestWake();
    setState({ ...state, listening: true });
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible" && state.listening) void requestWake();
  };

  speech.onResult = (result) => {
    error = "";
    if (result.isFinal) {
      void publishFinal(result.text);
      return;
    }
    setLiveInterim(result.text);
  };
  speech.onError = (message) => {
    error = message;
    if (message.includes("Microphone blocked") || message.includes("no Web Speech")) {
      speech.stop();
      releaseWake();
      typeForm.hidden = false;
      liveInterim = "";
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

  const applyTopic = (topic: TopicContent | null) => {
    error = "";
    els.topicInput.value = topic && topic.id === "custom" ? topic.title.en : "";
    setState({ ...state, topic });
  };

  const onTopicChip = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-topic]");
    if (!btn) return;
    const id = btn.dataset.topic ?? "";
    applyTopic(TOPIC_LIST.find((topic) => topic.id === id) ?? null);
  };

  const onClearTopic = () => applyTopic(null);

  const onTopicForm = (event: Event) => {
    event.preventDefault();
    const query = els.topicInput.value.trim();
    if (!query) {
      applyTopic(null);
      return;
    }
    applyTopic(resolveTopic(query));
  };

  const paintSendTv = () => {
    const url = tvUrl(room);
    qrBox.innerHTML = tvQrSvg(url);
    urlEl.textContent = url;
  };

  const setSmartViewMode = (next: boolean) => {
    smartViewMode = next;
    if (next) onCloseSendTv();
    renderDynamic();
  };

  const onEnterSmartView = () => setSmartViewMode(true);
  const onExitSmartView = () => setSmartViewMode(false);

  const onSendTv = () => {
    paintSendTv();
    copyBtn.textContent = "Copy TV link";
    sendBtn.setAttribute("aria-expanded", "true");
    if (typeof sendDialog.showModal === "function") sendDialog.showModal();
    else sendDialog.setAttribute("open", "");
  };

  const onCloseSendTv = () => {
    sendBtn.setAttribute("aria-expanded", "false");
    if (typeof sendDialog.close === "function" && sendDialog.open) sendDialog.close();
    else sendDialog.removeAttribute("open");
  };

  const onDialogClose = () => {
    sendBtn.setAttribute("aria-expanded", "false");
  };

  const onDialogClick = (event: Event) => {
    if (event.target === sendDialog) onCloseSendTv();
  };

  const onOpenTv = () => window.open(tvUrl(room), "ff-tv", "noopener");
  const onCopy = async () => {
    const url = tvUrl(room);
    try {
      await navigator.clipboard.writeText(url);
      error = "TV link copied.";
      copyBtn.textContent = "Copied";
      window.clearTimeout(copyLabelTimer);
      copyLabelTimer = window.setTimeout(() => {
        copyBtn.textContent = "Copy TV link";
      }, 1600);
      renderDynamic();
    } catch {
      error = url;
      copyBtn.textContent = "Copy TV link";
      renderDynamic();
    }
  };
  const onClear = () => {
    liveInterim = "";
    publishEpoch += 1;
    setState({ ...state, lines: [] });
  };
  const onHome = () => {
    speech.stop();
    releaseWake();
    goto("home");
  };
  const onType = (event: Event) => {
    event.preventDefault();
    const input = typeForm.elements.namedItem("caption") as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    void publishFinal(text, false);
  };

  els.mic.addEventListener("click", onMic);
  document.addEventListener("visibilitychange", onVisibility);
  sourceBox.addEventListener("click", onSource);
  layoutBox.addEventListener("click", onLayout);
  topicBox.addEventListener("click", onTopicChip);
  root.querySelector("[data-clear-topic]")?.addEventListener("click", onClearTopic);
  topicForm.addEventListener("submit", onTopicForm);
  sendBtn.addEventListener("click", onSendTv);
  smartEnter.addEventListener("click", onEnterSmartView);
  smartExit.addEventListener("click", onExitSmartView);
  smartMic.addEventListener("click", onMic);
  root.querySelector("[data-send-tv-close]")?.addEventListener("click", onCloseSendTv);
  sendDialog.addEventListener("click", onDialogClick);
  sendDialog.addEventListener("close", onDialogClose);
  root.querySelector("[data-open-tv]")?.addEventListener("click", onOpenTv);
  copyBtn.addEventListener("click", onCopy);
  root.querySelector("[data-clear]")?.addEventListener("click", onClear);
  root.querySelector("[data-home]")?.addEventListener("click", onHome);
  typeForm.addEventListener("submit", onType);

  conn = connectRoom({
    room,
    role: "phone",
    onState(next) {
      if (hydrated) return;
      hydrated = true;
      state = {
        ...next,
        room,
        listening: false,
        topic: normalizeTopic(next.topic),
        lines: finalizedLines(next.lines ?? []),
      };
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
    releaseWake();
    conn?.close();
    window.clearTimeout(copyLabelTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    els.mic.removeEventListener("click", onMic);
    sourceBox.removeEventListener("click", onSource);
    layoutBox.removeEventListener("click", onLayout);
    topicBox.removeEventListener("click", onTopicChip);
    topicForm.removeEventListener("submit", onTopicForm);
    sendDialog.removeEventListener("click", onDialogClick);
    sendDialog.removeEventListener("close", onDialogClose);
    sendBtn.removeEventListener("click", onSendTv);
    smartEnter.removeEventListener("click", onEnterSmartView);
    smartExit.removeEventListener("click", onExitSmartView);
    smartMic.removeEventListener("click", onMic);
    typeForm.removeEventListener("submit", onType);
    onCloseSendTv();
  };
}

function renderTopicPreview(topic: TopicContent | null, lang: Lang): string {
  if (!hasTopicBody(topic) || !topic) {
    return `<p class="hint">Pick a topic or insert one. Verse and handout go to the TV.</p>`;
  }
  const title = localized(topic.title, lang);
  const verse = localized(topic.verse, lang);
  return `
    ${title ? `<p class="topic-preview-kicker">${escapeHtml(title)}</p>` : ""}
    ${renderTopicHandout(topic, lang)}
    ${!verse && topic.id === "custom" ? `<p class="hint">No built-in verse for this custom topic.</p>` : ""}
  `;
}
