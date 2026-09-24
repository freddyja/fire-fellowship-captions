import { brandBlock } from "../brand";
import { applyI18n, readUiLang, subscribeUiLang, t } from "../ui-lang";
import { appendFinalLine, applyFinalLine, finalizedLines, previewCaption } from "../caption-history";
import { escapeHtml } from "../dom";
import { bindLocalSetup, localSetupInnerHtml } from "../local-setup";
import { bindOfflineModeToggle, isOfflineMeeting } from "../offline-mode";
import { tvQrSvg } from "../qr";
import { connectRoom, type RoomConnection } from "../realtime/client";
import { goto, joinUrl, tvUrl } from "../router";
import { createWebSpeechProvider, isNonFatalSpeechNote, isSpeechFallbackMessage } from "../stt/web-speech";
import { requestTopicHandout } from "../topic-ask";
import { renderTopicHandout } from "../topic-layout";
import { hasTopicBody, localized, normalizeTopic, resolveTopic, TOPIC_LIST } from "../topics";
import { createTranslator, detectLang, translateAll } from "../translate";
import { paintCaptionBoard } from "./caption-board";
import {
  captionSpeaker,
  emptyFloor,
  emptyState,
  floorHeldByOther,
  isFloorHolder,
  isLang,
  keepsLocalCaptions,
  lostFloor,
  reconcileFloor,
  LANG_LABEL,
  LANG_SHORT,
  LANGS,
  LAYOUTS,
  someoneElseSpeaking,
  speechLocale,
  type CaptionLine,
  type ConnStatus,
  type FloorState,
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
  let peers: PeerCounts = { phones: 1, tvs: 0, guests: 0 };
  let connStatus: ConnStatus = "connecting";
  let error = "";
  let conn: RoomConnection | null = null;
  let publishEpoch = 0;
  let hydrated = false;
  let wakeLock: WakeLockSentinel | null = null;
  let copyLabelTimer = 0;
  const copyLangTimers: Partial<Record<Lang, number>> = {};
  let copyJoinTimer = 0;
  let smartViewMode = false;
  let captionsOnly = readCaptionsOnlyPref();
  let liveInterim = "";
  let askBusy = false;
  let askQuery = "";
  let askAbort: AbortController | null = null;
  let lastCaptionWasMock = false;
  let sourceTouched = false;
  let pendingFinal = "";
  let peerId: string | null = null;
  let floor: FloorState = emptyFloor();

  const push = () => conn?.push(state);

  const setState = (next: RoomState, sync = true) => {
    state = { ...next, floor };
    renderDynamic();
    if (sync) push();
  };

  root.innerHTML = `
    <section class="screen phone-screen scene-bg">
      <div class="phone-top">
        ${brandBlock()}
        <div class="phone-status">
          <div class="room-pill"><span data-i18n="chrome.room">Room</span> <strong data-room></strong></div>
          <div class="status-pill"><span class="dot" data-dot></span><span data-status></span></div>
        </div>
      </div>

      <div class="phone-body">
        <div class="phone-main">
          <div class="controls topic-controls">
            <div>
              <p class="control-label"><span data-i18n="host.topic">Topic of the day</span> <button class="ghost topic-clear" data-clear-topic type="button" data-i18n="host.clear">Clear</button></p>
              <div class="chips" data-topics></div>
              <form class="topic-insert" data-topic-form>
                <input name="topic" autocomplete="off" enterkeyhint="go" data-i18n-placeholder="host.askPlaceholder" placeholder="head of household, contentment, forgiveness…" />
                <button class="primary topic-ask" data-ask type="submit" data-i18n="host.ask">Ask for topic</button>
                <button class="secondary" data-set-topic type="button" data-i18n="host.set">Set</button>
              </form>
              <p class="hint topic-ask-status" data-ask-status>Type a theme and tap <strong>Ask for topic</strong> — or tap a chip.</p>
              <div class="topic-preview" data-topic-preview></div>
            </div>
          </div>
        </div>

        <div class="phone-side">
          <div class="controls">
            <div class="meeting-mode">
              <p class="control-label" data-i18n="home.meetingMode">Meeting mode</p>
              <button class="chip" data-offline-mode type="button" aria-pressed="false" data-i18n="home.offline" data-i18n-aria="home.offlineAria" aria-label="Offline / Local meeting — use the built-in dictionary, no MyMemory">
                Offline / Local meeting
              </button>
              <p class="offline-banner" data-offline-banner hidden>
                <span data-i18n="home.offlineLead">Offline translate (limited phrases). For full local setup see</span>
                <button class="ghost setup-link" data-local-setup-open type="button" aria-haspopup="dialog" aria-controls="local-setup-dialog" data-i18n="home.laptopSteps">laptop steps</button>.
              </p>
            </div>
            <div>
              <p class="control-label" data-i18n="host.spokenLanguage">Spoken language</p>
              <div class="chips" data-source></div>
            </div>
            <div>
              <p class="control-label" data-i18n="host.tvLayout">TV layout</p>
              <div class="chips" data-layouts></div>
            </div>
            <div class="row-actions tv-path-actions">
              <button class="primary send-tv-btn" data-send-tv type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="send-tv-dialog" data-i18n="host.sendToTv" data-i18n-aria="host.sendToTvAria" aria-label="Send to TV — show QR and TV caption link">
                Send to TV
              </button>
              <button class="secondary smart-view-btn" data-smart-view-mode type="button" aria-pressed="false" data-i18n="host.smartView" data-i18n-aria="host.smartViewAria" aria-label="Smart View mode — show caption layout for system mirroring">
                Smart View mode
              </button>
              <button class="secondary join-phones-btn" data-join-phones type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="join-phones-dialog" data-i18n="host.joinPhones" data-i18n-aria="host.joinPhonesAria" aria-label="Join on phones — show QR so brothers can watch and speak">
                Join on phones
              </button>
            </div>
          </div>

          <div class="mic-wrap">
            <button class="mic" data-mic type="button" aria-pressed="false">
              ${micIcon}
              <small data-mic-label>Start</small>
            </button>
            <p class="hint" data-error></p>
            <p class="floor-banner" data-floor></p>
            <button class="secondary floor-reclaim" data-reclaim type="button" data-i18n="host.reclaim" hidden>Reclaim mic</button>
            <p class="hint mic-chrome-hint" data-i18n="host.micHint">Keep Chrome in the foreground while you speak.</p>
          </div>

          <div class="preview phone-caption-preview">
            <p class="control-label" data-i18n="host.onThisPhone">On this phone</p>
            <p data-preview></p>
            <div class="tv-board phone-live-board" data-phone-board></div>
            <aside class="tv-topic" data-phone-topic hidden></aside>
          </div>

          <div class="controls">
            <div class="row-actions">
              <button class="ghost" data-clear type="button" data-i18n="host.clearWindows">Clear windows</button>
              <button class="ghost" data-home type="button" data-i18n="chrome.leave">Leave</button>
            </div>
            <form class="typed-caption" data-type>
              <input name="caption" autocomplete="off" enterkeyhint="send" data-i18n-placeholder="join.orTypeCaption" placeholder="Or type a caption" />
              <button class="primary" type="submit" data-i18n="chrome.send">Send</button>
            </form>
          </div>
        </div>
      </div>

      <dialog class="send-tv-dialog" id="send-tv-dialog" data-send-tv-dialog aria-labelledby="send-tv-title">
        <div class="send-tv-sheet">
          <header class="send-tv-head">
            <h2 id="send-tv-title" data-i18n="host.sendTitle">Send to TV</h2>
            <button class="ghost send-tv-close" data-send-tv-close type="button" data-i18n="chrome.close">Close</button>
          </header>
          <div class="send-tv-qr" data-send-tv-qr></div>
          <p class="send-tv-url" data-send-tv-url></p>
          <button class="primary send-tv-copy" data-copy type="button" data-i18n="host.copyTv">Copy TV link</button>
          <ol class="send-tv-steps">
            <li data-i18n="host.sendStep1">On the TV browser, open this link or scan the QR.</li>
            <li data-i18n="host.sendStep2">Keep the Fold on the mic page.</li>
            <li data-i18n="host.sendStep3">Optional: three Chrome windows, one language per monitor — use the EN / ES / PT links below. That does not change other TVs in this room.</li>
          </ol>
          <button class="ghost send-tv-open" data-open-tv type="button" data-i18n="host.openTv" data-i18n-aria="host.openTvAria" aria-label="Open TV view on this device for testing">
            Open TV view
          </button>
          <section class="send-tv-langs" data-send-tv-langs>
            <h3 data-i18n="host.oneLanguage">One language per monitor</h3>
            <p class="hint" data-i18n="host.oneLanguageHint">Same room. Each window shows only that language, full-screen captions. Other TVs and Smart View still follow the layout chips.</p>
            <div class="send-tv-lang-list" data-send-tv-lang-list></div>
          </section>
        </div>
      </dialog>

      <dialog class="send-tv-dialog" id="join-phones-dialog" data-join-phones-dialog aria-labelledby="join-phones-title">
        <div class="send-tv-sheet">
          <header class="send-tv-head">
            <h2 id="join-phones-title" data-i18n="host.joinTitle">Join on phones</h2>
            <button class="ghost send-tv-close" data-join-phones-close type="button" data-i18n="chrome.close">Close</button>
          </header>
          <p class="hint" data-i18n="host.brothersScan">Brothers scan to watch &amp; speak</p>
          <div class="send-tv-qr" data-join-phones-qr></div>
          <p class="send-tv-url" data-join-phones-url></p>
          <button class="primary send-tv-copy" data-copy-join type="button" data-i18n="host.copyJoin">Copy join link</button>
          <ol class="send-tv-steps">
            <li data-i18n="host.joinStep1">Each brother scans this QR (camera app or Chrome) — Android or iPhone.</li>
            <li data-i18n="host.joinStep2">Before the captions, they answer what language they are speaking and what language they want to watch, then tap Join. Watch stays on that phone. The TV still follows this room’s layout.</li>
            <li data-i18n="host.joinStep3">One speaker at a time. Chrome on Android is best for live speech; iPhone can always watch, and type a caption if the mic is not available.</li>
          </ol>
        </div>
      </dialog>

      <dialog class="setup-dialog" id="local-setup-dialog" data-local-setup-dialog aria-labelledby="local-setup-title">
        <div class="send-tv-sheet">
          <header class="send-tv-head">
            <h2 id="local-setup-title" data-i18n="setup.title">Laptop LAN / hotspot</h2>
            <button class="ghost send-tv-close" data-local-setup-close type="button">Close</button>
          </header>
          <div data-local-setup>
            ${localSetupInnerHtml({ heading: false })}
          </div>
        </div>
      </dialog>

      <div class="smart-view-layer" data-smart-view-layer hidden>
        <section class="screen tv-screen smart-view-captions">
          <div class="tv-top">
            ${brandBlock(true)}
            <div class="tv-meta">
              <div class="room-pill"><span data-i18n="chrome.room">Room</span> <strong data-sv-room></strong></div>
              <div class="status-pill"><span class="dot" data-sv-dot></span><span data-sv-status></span></div>
            </div>
          </div>
          <aside class="tv-topic" data-sv-topic hidden></aside>
          <main class="tv-board" data-sv-board></main>
          <div class="smart-view-dock">
            <p class="smart-view-tip" data-i18n="host.smartTip">Now open system Smart View → My TV. TV will mirror these captions.</p>
            <div class="smart-view-controls">
              <div class="smart-view-source" role="group" aria-label="Spoken language">
                <span class="smart-view-source-label" data-i18n="join.spoken">Spoken</span>
                <div class="chips smart-view-source-chips" data-smart-source></div>
              </div>
              <button class="chip smart-view-captions-only" data-captions-only type="button" aria-pressed="true" data-i18n="join.captionsOnly" data-i18n-aria="join.captionsOnlyAria" aria-label="Captions only — hide the topic handout on this mirrored view">
                Captions only
              </button>
              <button class="smart-view-mic" data-smart-mic type="button" aria-pressed="false">
                ${micIcon}
                <small data-smart-mic-label>Start</small>
              </button>
              <button class="secondary" data-exit-smart-view type="button" data-i18n="host.exitSmart">Exit Smart View mode</button>
            </div>
          </div>
        </section>
      </div>
    </section>
  `;

  const sourceBox = root.querySelector("[data-source]") as HTMLElement;
  const smartSourceBox = root.querySelector("[data-smart-source]") as HTMLElement;
  const layoutBox = root.querySelector("[data-layouts]") as HTMLElement;
  const topicBox = root.querySelector("[data-topics]") as HTMLElement;
  const topicForm = root.querySelector("[data-topic-form]") as HTMLFormElement;
  const topicPreview = root.querySelector("[data-topic-preview]") as HTMLElement;
  const askBtn = root.querySelector("[data-ask]") as HTMLButtonElement;
  const setBtn = root.querySelector("[data-set-topic]") as HTMLButtonElement;
  const askStatus = root.querySelector("[data-ask-status]") as HTMLElement;
  sourceBox.innerHTML = LANGS.map(
    (lang) => `<button class="chip" type="button" data-lang="${lang}">${LANG_SHORT[lang]} ${LANG_LABEL[lang]}</button>`,
  ).join("");
  smartSourceBox.innerHTML = LANGS.map(
    (lang) =>
      `<button class="chip smart-view-source-chip" type="button" data-lang="${lang}" aria-label="Spoken language: ${LANG_LABEL[lang]}" aria-pressed="false">${LANG_SHORT[lang]}</button>`,
  ).join("");
  layoutBox.innerHTML = LAYOUTS.map(
    (item) => `<button class="chip" type="button" data-layout="${item.id}">${item.label}</button>`,
  ).join("");
  const paintTopicChips = () => {
    topicBox.innerHTML = TOPIC_LIST.map(
      (topic) =>
        `<button class="chip" type="button" data-topic="${topic.id}">${escapeHtml(localized(topic.title, readUiLang()))}</button>`,
    ).join("");
  };
  paintTopicChips();

  const typeForm = root.querySelector("[data-type]") as HTMLFormElement;
  const sendBtn = root.querySelector("[data-send-tv]") as HTMLButtonElement;
  const sendDialog = root.querySelector("[data-send-tv-dialog]") as HTMLDialogElement;
  const qrBox = root.querySelector("[data-send-tv-qr]") as HTMLElement;
  const urlEl = root.querySelector("[data-send-tv-url]") as HTMLElement;
  const copyBtn = root.querySelector("[data-copy]") as HTMLButtonElement;
  const langList = root.querySelector("[data-send-tv-lang-list]") as HTMLElement;
  const joinBtn = root.querySelector("[data-join-phones]") as HTMLButtonElement;
  const joinDialog = root.querySelector("[data-join-phones-dialog]") as HTMLDialogElement;
  const joinQr = root.querySelector("[data-join-phones-qr]") as HTMLElement;
  const joinUrlEl = root.querySelector("[data-join-phones-url]") as HTMLElement;
  const copyJoinBtn = root.querySelector("[data-copy-join]") as HTMLButtonElement;
  const reclaimBtn = root.querySelector("[data-reclaim]") as HTMLButtonElement;
  const screen = root.querySelector(".phone-screen") as HTMLElement;
  const smartLayer = root.querySelector("[data-smart-view-layer]") as HTMLElement;
  const smartEnter = root.querySelector("[data-smart-view-mode]") as HTMLButtonElement;
  const smartExit = root.querySelector("[data-exit-smart-view]") as HTMLButtonElement;
  const smartMic = root.querySelector("[data-smart-mic]") as HTMLButtonElement;
  const captionsOnlyBtn = root.querySelector("[data-captions-only]") as HTMLButtonElement;
  const smartCaptions = root.querySelector(".smart-view-captions") as HTMLElement;
  const svBoard = root.querySelector("[data-sv-board]") as HTMLElement;
  const svTopic = root.querySelector("[data-sv-topic]") as HTMLElement;
  const landscapeMq = window.matchMedia("(orientation: landscape)");
  const offlineBtn = root.querySelector("[data-offline-mode]") as HTMLButtonElement;
  const offlineBanner = root.querySelector("[data-offline-banner]") as HTMLElement;
  const setupDialog = root.querySelector("[data-local-setup-dialog]") as HTMLDialogElement;
  const setupOpen = root.querySelector("[data-local-setup-open]") as HTMLButtonElement;
  const setupClose = root.querySelector("[data-local-setup-close]") as HTMLButtonElement;
  const localSetup = root.querySelector("[data-local-setup]") as HTMLElement;

  const syncSmartViewOrientation = () => {
    const landscape = landscapeMq.matches || window.innerWidth > window.innerHeight;
    smartCaptions.dataset.orientation = landscape ? "landscape" : "portrait";
  };

  const els = {
    room: root.querySelector("[data-room]") as HTMLElement,
    status: root.querySelector("[data-status]") as HTMLElement,
    dot: root.querySelector("[data-dot]") as HTMLElement,
    mic: root.querySelector("[data-mic]") as HTMLButtonElement,
    micLabel: root.querySelector("[data-mic-label]") as HTMLElement,
    error: root.querySelector("[data-error]") as HTMLElement,
    preview: root.querySelector("[data-preview]") as HTMLElement,
    phoneBoard: root.querySelector("[data-phone-board]") as HTMLElement,
    phoneTopic: root.querySelector("[data-phone-topic]") as HTMLElement,
    topicInput: topicForm.elements.namedItem("topic") as HTMLInputElement,
    svRoom: root.querySelector("[data-sv-room]") as HTMLElement,
    svStatus: root.querySelector("[data-sv-status]") as HTMLElement,
    svDot: root.querySelector("[data-sv-dot]") as HTMLElement,
    smartMicLabel: root.querySelector("[data-smart-mic-label]") as HTMLElement,
    floor: root.querySelector("[data-floor]") as HTMLElement,
  };

  function renderDynamic() {
    els.room.textContent = state.room;
    const blocked = floorHeldByOther(floor, peerId);
    const holding = isFloorHolder(floor, peerId);
    const tvNote = peers.tvs > 0 ? `${t("host.tvConnected")} (${peers.tvs})` : t("host.waitingForTv");
    const guestNote = peers.guests > 0 ? ` · ${peers.guests} ${t("host.onPhones")}` : "";
    const connNote =
      connStatus === "live" ? `${tvNote}${guestNote}` : connStatus === "connecting" ? t("chrome.connecting") : t("chrome.reconnecting");
    els.status.textContent = state.listening ? `${t("chrome.listening")} · ${connNote}` : connNote;
    els.dot.className = `dot ${state.listening ? "listening" : connStatus === "live" ? "live" : "offline"}`;
    els.mic.classList.toggle("hot", holding && state.listening);
    els.mic.disabled = blocked;
    els.mic.setAttribute("aria-pressed", String(holding && state.listening));
    els.micLabel.textContent = holding && state.listening ? t("chrome.stop") : blocked ? t("chrome.wait") : t("chrome.start");
    if (blocked) {
      els.floor.textContent = someoneElseSpeaking(floor);
    } else if (holding && state.listening) {
      els.floor.textContent = t("host.youSpeaking");
    } else if (peers.guests > 0) {
      els.floor.textContent = t("host.micFree");
    } else {
      els.floor.textContent = "";
    }
    reclaimBtn.hidden = !blocked;
    els.error.textContent = error;
    const lastFinal = finalizedLines(state.lines).at(-1);
    const spoken = previewCaption(lastFinal, state.sourceLang);
    if (liveInterim && holding) {
      els.preview.textContent = liveInterim;
    } else if (spoken) {
      els.preview.textContent = spoken;
    } else if (holding && state.listening) {
      els.preview.textContent = t("chrome.listeningEllipsis");
    } else {
      els.preview.textContent = t("host.captionsHere");
    }
    els.preview.classList.toggle("interim", Boolean(liveInterim && holding) || (holding && state.listening && !lastFinal));
    paintCaptionBoard(
      els.phoneBoard,
      els.phoneTopic,
      { layout: state.layout, lines: finalizedLines(state.lines), topic: null, floor },
      liveInterim && holding ? { text: liveInterim, sourceLang: state.sourceLang, speaker: captionSpeaker(floor.holderName, "host") } : null,
    );
    els.phoneTopic.hidden = true;
    els.phoneTopic.innerHTML = "";

    screen.classList.toggle("is-smart-view", smartViewMode);
    smartLayer.hidden = !smartViewMode;
    if (smartViewMode) syncSmartViewOrientation();
    smartEnter.setAttribute("aria-pressed", String(smartViewMode));
    smartCaptions.classList.toggle("is-captions-only", captionsOnly);
    captionsOnlyBtn.classList.toggle("active", captionsOnly);
    captionsOnlyBtn.setAttribute("aria-pressed", String(captionsOnly));
    smartMic.classList.toggle("hot", holding && state.listening);
    smartMic.disabled = blocked;
    smartMic.setAttribute("aria-pressed", String(holding && state.listening));
    els.smartMicLabel.textContent = holding && state.listening ? t("chrome.stop") : blocked ? t("chrome.wait") : t("chrome.start");
    els.svRoom.textContent = state.room;
    const speaker =
      blocked && floor.holderName
        ? someoneElseSpeaking(floor)
        : state.listening
          ? `${t("chrome.listening")} · ${t("host.smartView")}`
          : t("host.smartView");
    els.svStatus.textContent = speaker;
    els.svDot.className = `dot ${state.listening ? "listening" : connStatus === "live" ? "live" : "offline"}`;
    if (smartViewMode) {
      paintCaptionBoard(
        svBoard,
        svTopic,
        { ...state, lines: finalizedLines(state.lines), floor },
        liveInterim ? { text: liveInterim, sourceLang: state.sourceLang, speaker: captionSpeaker(floor.holderName, "host") } : null,
      );
      if (captionsOnly) {
        svTopic.hidden = true;
        svTopic.innerHTML = "";
      }
    }

    for (const btn of root.querySelectorAll<HTMLButtonElement>(
      "[data-source] [data-lang], [data-smart-source] [data-lang]",
    )) {
      const on = btn.dataset.lang === state.sourceLang;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    }
    for (const btn of layoutBox.querySelectorAll<HTMLButtonElement>("[data-layout]")) {
      btn.classList.toggle("active", btn.dataset.layout === state.layout);
    }
    for (const btn of topicBox.querySelectorAll<HTMLButtonElement>("[data-topic]")) {
      btn.classList.toggle("active", state.topic?.id === btn.dataset.topic);
    }
    askBtn.disabled = askBusy;
    askBtn.textContent = askBusy ? t("host.writing") : t("host.ask");
    els.topicInput.disabled = askBusy;
    setBtn.disabled = askBusy;
    if (askBusy) {
      askStatus.innerHTML = `${escapeHtml(t("host.writingFor", { query: askQuery }))} <button class="ghost topic-ask-cancel" data-cancel-ask type="button">${escapeHtml(t("chrome.cancel"))}</button>`;
      topicPreview.innerHTML = `<p class="hint">${escapeHtml(t("host.hangOn"))}</p>`;
    } else {
      askStatus.innerHTML = t("host.askStatus");
      topicPreview.innerHTML = renderTopicPreview(state.topic, state.sourceLang);
    }
  }

  function setLiveInterim(text: string) {
    const next = text.trim();
    if (next === liveInterim) return;
    liveInterim = next;
    renderDynamic();
  }

  async function publishFinal(text: string, coalesce = true) {
    const spoken = text.trim();
    if (!spoken || floorHeldByOther(floor, peerId)) return;
    const spokenAs = state.sourceLang;
    const speaker = captionSpeaker(floor.holderName, "host");
    liveInterim = "";
    renderDynamic();
    const epoch = publishEpoch;
    const from = detectLang(spoken, spokenAs);
    const translated = await translateAll(translator, spoken, from);
    if (epoch !== publishEpoch) return;
    lastCaptionWasMock = translator.id === "mock";
    paintLimitedBanner();
    const line: CaptionLine = {
      id: crypto.randomUUID(),
      isFinal: true,
      speaker,
      text: translated,
      at: Date.now(),
    };
    const lines = coalesce
      ? applyFinalLine(state.lines, line, from)
      : appendFinalLine(state.lines, line);
    setState({ ...state, lines });
  }

  let publishQueue: Promise<void> = Promise.resolve();
  const queuePublish = (text: string, coalesce = true) => {
    publishQueue = publishQueue.then(() => publishFinal(text, coalesce)).catch(() => undefined);
  };

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

  const stopLocalMic = () => {
    speech.stop();
    releaseWake();
    liveInterim = "";
    state = { ...state, listening: false, floor };
  };

  const onMic = () => {
    error = "";
    if (isFloorHolder(floor, peerId)) {
      stopLocalMic();
      pendingFinal = "";
      void (async () => {
        await conn?.releaseFloor();
        setState({ ...state, listening: false });
      })();
      return;
    }
    if (floorHeldByOther(floor, peerId)) {
      error = someoneElseSpeaking(floor);
      renderDynamic();
      return;
    }
    // Start on the click stack. iOS rejects recognition.start() after an await.
    // Prime the reused recognizer's lang before start(), including es-ES / pt-BR.
    speech.setLang(speechLocale(state.sourceLang), true);
    speech.start();
    void (async () => {
      const ok = (await conn?.claimFloor("Host")) ?? false;
      if (!ok) {
        speech.stop();
        pendingFinal = "";
        error = someoneElseSpeaking(floor);
        renderDynamic();
        return;
      }
      if (isSpeechFallbackMessage(error) && !isNonFatalSpeechNote(error)) {
        speech.stop();
        releaseWake();
        typeForm.hidden = false;
        pendingFinal = "";
        setState({ ...state, listening: false });
        return;
      }
      void requestWake();
      setState({ ...state, listening: true });
      const queued = pendingFinal.trim();
      pendingFinal = "";
      if (queued) queuePublish(queued);
    })();
  };

  const onReclaim = () => {
    error = "";
    // start() in this tap. iOS rejects recognition.start() after an await.
    speech.setLang(speechLocale(state.sourceLang), true);
    speech.start();
    void (async () => {
      const freed = (await conn?.forceRelease()) ?? false;
      if (!freed) {
        speech.stop();
        error = "Could not reclaim the mic.";
        renderDynamic();
        return;
      }
      const ok = (await conn?.claimFloor("Host")) ?? false;
      if (!ok) {
        speech.stop();
        error = someoneElseSpeaking(floor);
        renderDynamic();
        return;
      }
      if (isSpeechFallbackMessage(error) && !isNonFatalSpeechNote(error)) {
        speech.stop();
        typeForm.hidden = false;
        setState({ ...state, listening: false });
        return;
      }
      void requestWake();
      setState({ ...state, listening: true });
    })();
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible" && state.listening) void requestWake();
  };

  speech.onResult = (result) => {
    error = "";
    if (result.isFinal) {
      if (isFloorHolder(floor, peerId)) {
        pendingFinal = "";
        queuePublish(result.text);
      } else if (!floorHeldByOther(floor, peerId)) {
        pendingFinal = result.text;
      }
      return;
    }
    if (!isFloorHolder(floor, peerId)) return;
    setLiveInterim(result.text);
  };
  speech.onError = (message) => {
    error = message;
    if (isNonFatalSpeechNote(message)) {
      typeForm.hidden = false;
      renderDynamic();
      return;
    }
    if (isSpeechFallbackMessage(message)) {
      speech.stop();
      releaseWake();
      typeForm.hidden = false;
      liveInterim = "";
      if (message.includes("Microphone blocked") || message.includes("no Web Speech")) {
        void conn?.releaseFloor();
      }
      setState({ ...state, listening: false });
      return;
    }
    renderDynamic();
  };

  const onSource = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-lang]");
    if (!btn?.dataset.lang) return;
    const sourceLang = btn.dataset.lang as Lang;
    if (!isLang(sourceLang)) return;
    sourceTouched = true;
    if (sourceLang !== state.sourceLang) liveInterim = "";
    // While listening, setLang retargets the recognizer in this tap.
    // Chrome rebuilds it. iOS reuses the original object so the locale sticks.
    speech.setLang(speechLocale(sourceLang), true);
    setState({ ...state, sourceLang });
  };

  const onLayout = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-layout]");
    if (!btn?.dataset.layout) return;
    setState({ ...state, layout: btn.dataset.layout as Layout });
  };

  const cancelAsk = () => {
    askAbort?.abort();
    askAbort = null;
    askBusy = false;
    askQuery = "";
  };

  const applyTopic = (topic: TopicContent | null) => {
    error = "";
    cancelAsk();
    els.topicInput.value = topic && (topic.id === "custom" || topic.id.startsWith("asked-")) ? topic.title.en : "";
    setState({ ...state, topic: topic ? normalizeTopic(topic) : null });
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
    onAskTopic();
  };

  const onSetTopic = () => {
    const query = els.topicInput.value.trim();
    if (!query) {
      applyTopic(null);
      return;
    }
    applyTopic(resolveTopic(query));
  };

  const onAskTopic = () => {
    const query = els.topicInput.value.trim();
    if (!query) {
      error = "Type a topic first — head of household, contentment, forgiveness…";
      els.topicInput.focus();
      renderDynamic();
      return;
    }
    const seed = resolveTopic(query);
    if (seed && seed.id !== "custom" && seed.reference) {
      applyTopic(seed);
      return;
    }
    error = "";
    askAbort?.abort();
    askAbort = new AbortController();
    askBusy = true;
    askQuery = query;
    renderDynamic();
    const signal = askAbort.signal;
    void requestTopicHandout(query, signal)
      .then((topic) => {
        if (signal.aborted) return;
        applyTopic(topic);
      })
      .catch((err: unknown) => {
        if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        askBusy = false;
        askQuery = "";
        error = err instanceof Error ? err.message : t("host.couldNotWrite");
        renderDynamic();
      });
  };

  const onCancelAsk = (event: Event) => {
    const btn = (event.target as HTMLElement).closest("[data-cancel-ask]");
    if (!btn) return;
    cancelAsk();
    error = "";
    renderDynamic();
  };

  const paintSendTv = () => {
    const url = tvUrl(room);
    qrBox.innerHTML = tvQrSvg(url);
    urlEl.textContent = url;
    langList.innerHTML = LANGS.map((lang) => {
      const langUrl = tvUrl(room, lang);
      return `
        <article class="send-tv-lang">
          <div class="send-tv-lang-qr">${tvQrSvg(langUrl, `QR code for ${LANG_LABEL[lang]} TV captions`)}</div>
          <div class="send-tv-lang-meta">
            <p class="control-label">${LANG_SHORT[lang]} · ${LANG_LABEL[lang]}</p>
            <p class="send-tv-lang-url">${escapeHtml(langUrl)}</p>
            <div class="send-tv-lang-actions">
              <button class="secondary" data-copy-lang="${lang}" type="button">${escapeHtml(t("host.copyLangLink", { lang: LANG_SHORT[lang] }))}</button>
              <button class="ghost" data-open-lang="${lang}" type="button">${escapeHtml(t("host.open"))}</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  };

  const paintJoinPhones = () => {
    const url = joinUrl(room);
    joinQr.innerHTML = tvQrSvg(url, "QR code so brothers can join this meeting on their phones");
    joinUrlEl.textContent = url;
  };

  const onJoinPhones = () => {
    paintJoinPhones();
    copyJoinBtn.textContent = t("host.copyJoin");
    joinBtn.setAttribute("aria-expanded", "true");
    if (typeof joinDialog.showModal === "function") joinDialog.showModal();
    else joinDialog.setAttribute("open", "");
  };

  const onCloseJoinPhones = () => {
    joinBtn.setAttribute("aria-expanded", "false");
    if (typeof joinDialog.close === "function" && joinDialog.open) joinDialog.close();
    else joinDialog.removeAttribute("open");
  };

  const onJoinDialogClose = () => {
    joinBtn.setAttribute("aria-expanded", "false");
  };

  const onJoinDialogClick = (event: Event) => {
    if (event.target === joinDialog) onCloseJoinPhones();
  };

  const onCopyJoin = async () => {
    const url = joinUrl(room);
    try {
      await navigator.clipboard.writeText(url);
      error = t("host.joinCopied");
      copyJoinBtn.textContent = t("chrome.copied");
      window.clearTimeout(copyJoinTimer);
      copyJoinTimer = window.setTimeout(() => {
        copyJoinBtn.textContent = t("host.copyJoin");
      }, 1600);
      renderDynamic();
    } catch {
      error = url;
      copyJoinBtn.textContent = t("host.copyJoin");
      renderDynamic();
    }
  };

  const setSmartViewMode = (next: boolean) => {
    smartViewMode = next;
    if (next) onCloseSendTv();
    renderDynamic();
  };

  const onEnterSmartView = () => setSmartViewMode(true);
  const onExitSmartView = () => setSmartViewMode(false);

  const onCaptionsOnly = () => {
    captionsOnly = !captionsOnly;
    writeCaptionsOnlyPref(captionsOnly);
    renderDynamic();
  };

  const onOpenLocalSetup = () => {
    if (typeof setupDialog.showModal === "function") setupDialog.showModal();
    else setupDialog.setAttribute("open", "");
  };

  const onCloseLocalSetup = () => {
    if (typeof setupDialog.close === "function" && setupDialog.open) setupDialog.close();
    else setupDialog.removeAttribute("open");
  };

  const onSetupDialogClick = (event: Event) => {
    if (event.target === setupDialog) onCloseLocalSetup();
  };

  const onSendTv = () => {
    paintSendTv();
    copyBtn.textContent = t("host.copyTv");
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
  const onLangActions = (event: Event) => {
    const target = event.target as HTMLElement;
    const openBtn = target.closest<HTMLButtonElement>("[data-open-lang]");
    const copyLangBtn = target.closest<HTMLButtonElement>("[data-copy-lang]");
    const langValue = openBtn?.dataset.openLang ?? copyLangBtn?.dataset.copyLang;
    if (!isLang(langValue)) return;
    const url = tvUrl(room, langValue);
    if (openBtn) {
      window.open(url, `ff-tv-${langValue}`, "noopener");
      return;
    }
    if (!copyLangBtn) return;
    void (async () => {
      const restore = t("host.copyLangLink", { lang: LANG_SHORT[langValue] });
      try {
        await navigator.clipboard.writeText(url);
        error = t("host.langCopied", { lang: LANG_SHORT[langValue] });
        copyLangBtn.textContent = t("chrome.copied");
        window.clearTimeout(copyLangTimers[langValue]);
        copyLangTimers[langValue] = window.setTimeout(() => {
          copyLangBtn.textContent = restore;
        }, 1600);
        renderDynamic();
      } catch {
        error = url;
        copyLangBtn.textContent = restore;
        renderDynamic();
      }
    })();
  };
  const onCopy = async () => {
    const url = tvUrl(room);
    try {
      await navigator.clipboard.writeText(url);
      error = t("host.tvCopied");
      copyBtn.textContent = t("chrome.copied");
      window.clearTimeout(copyLabelTimer);
      copyLabelTimer = window.setTimeout(() => {
        copyBtn.textContent = t("host.copyTv");
      }, 1600);
      renderDynamic();
    } catch {
      error = url;
      copyBtn.textContent = t("host.copyTv");
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
    void conn?.releaseFloor();
    goto("home");
  };
  const onType = (event: Event) => {
    event.preventDefault();
    void (async () => {
      const input = typeForm.elements.namedItem("caption") as HTMLInputElement;
      const text = input.value.trim();
      if (!text) return;
      if (floorHeldByOther(floor, peerId)) {
        error = someoneElseSpeaking(floor);
        renderDynamic();
        return;
      }
      if (!isFloorHolder(floor, peerId)) {
        const ok = (await conn?.claimFloor("Host")) ?? false;
        if (!ok) {
          error = someoneElseSpeaking(floor);
          renderDynamic();
          return;
        }
      }
      input.value = "";
      queuePublish(text, false);
    })();
  };

  const onOrientationChange = () => syncSmartViewOrientation();
  landscapeMq.addEventListener("change", onOrientationChange);
  window.addEventListener("resize", onOrientationChange);
  window.addEventListener("orientationchange", onOrientationChange);
  syncSmartViewOrientation();

  els.mic.addEventListener("click", onMic);
  document.addEventListener("visibilitychange", onVisibility);
  sourceBox.addEventListener("click", onSource);
  smartSourceBox.addEventListener("click", onSource);
  layoutBox.addEventListener("click", onLayout);
  topicBox.addEventListener("click", onTopicChip);
  root.querySelector("[data-clear-topic]")?.addEventListener("click", onClearTopic);
  topicForm.addEventListener("submit", onTopicForm);
  setBtn.addEventListener("click", onSetTopic);
  askStatus.addEventListener("click", onCancelAsk);
  sendBtn.addEventListener("click", onSendTv);
  joinBtn.addEventListener("click", onJoinPhones);
  reclaimBtn.addEventListener("click", onReclaim);
  smartEnter.addEventListener("click", onEnterSmartView);
  smartExit.addEventListener("click", onExitSmartView);
  captionsOnlyBtn.addEventListener("click", onCaptionsOnly);
  smartMic.addEventListener("click", onMic);
  const paintLimitedBanner = () => {
    offlineBanner.hidden = !(isOfflineMeeting() || lastCaptionWasMock);
  };
  const unbindOffline = bindOfflineModeToggle(offlineBtn, {
    banner: offlineBanner,
    bannerWhen: () => lastCaptionWasMock,
    onChange: () => paintLimitedBanner(),
  });
  const unbindSetup = bindLocalSetup(localSetup);
  setupOpen.addEventListener("click", onOpenLocalSetup);
  setupClose.addEventListener("click", onCloseLocalSetup);
  setupDialog.addEventListener("click", onSetupDialogClick);
  root.querySelector("[data-send-tv-close]")?.addEventListener("click", onCloseSendTv);
  sendDialog.addEventListener("click", onDialogClick);
  sendDialog.addEventListener("close", onDialogClose);
  joinDialog.addEventListener("click", onJoinDialogClick);
  joinDialog.addEventListener("close", onJoinDialogClose);
  root.querySelector("[data-join-phones-close]")?.addEventListener("click", onCloseJoinPhones);
  copyJoinBtn.addEventListener("click", onCopyJoin);
  root.querySelector("[data-open-tv]")?.addEventListener("click", onOpenTv);
  langList.addEventListener("click", onLangActions);
  copyBtn.addEventListener("click", onCopy);
  root.querySelector("[data-clear]")?.addEventListener("click", onClear);
  root.querySelector("[data-home]")?.addEventListener("click", onHome);
  typeForm.addEventListener("submit", onType);

  conn = connectRoom({
    room,
    role: "phone",
    name: "Host",
    onJoined(info) {
      peerId = info.peerId;
      floor = info.floor ?? floor;
      state = { ...state, floor };
      renderDynamic();
    },
    onFloor(next) {
      const lost = lostFloor(floor, next, peerId);
      floor = next;
      if (lost) {
        publishEpoch += 1;
        pendingFinal = "";
        stopLocalMic();
        error = someoneElseSpeaking(next);
        setState({ ...state, listening: false }, false);
        return;
      }
      if (isFloorHolder(next, peerId) && error.startsWith("Someone else is speaking")) error = "";
      state = { ...state, floor: next };
      renderDynamic();
    },
    onState(next) {
      const holding = keepsLocalCaptions(floor, next.floor, peerId);
      floor = reconcileFloor(floor, next.floor, peerId);
      if (!hydrated) {
        hydrated = true;
        state = {
          ...next,
          room,
          floor,
          listening: false,
          sourceLang:
            sourceTouched && isLang(state.sourceLang)
              ? state.sourceLang
              : isLang(next.sourceLang)
                ? next.sourceLang
                : state.sourceLang,
          topic: normalizeTopic(next.topic),
          lines: finalizedLines(next.lines ?? []),
        };
        speech.setLang(speechLocale(state.sourceLang));
        renderDynamic();
        return;
      }
      state = {
        ...state,
        floor,
        topic: normalizeTopic(next.topic),
        layout: next.layout ?? state.layout,
        lines: holding ? state.lines : finalizedLines(next.lines ?? []),
        listening: holding ? state.listening : Boolean(next.listening),
      };
      renderDynamic();
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
  applyI18n(root);
  const unsubUiLang = subscribeUiLang(() => {
    paintTopicChips();
    applyI18n(root);
    renderDynamic();
  });

  return () => {
    speech.stop();
    releaseWake();
    conn?.close();
    window.clearTimeout(copyLabelTimer);
    window.clearTimeout(copyJoinTimer);
    for (const timer of Object.values(copyLangTimers)) window.clearTimeout(timer);
    landscapeMq.removeEventListener("change", onOrientationChange);
    window.removeEventListener("resize", onOrientationChange);
    window.removeEventListener("orientationchange", onOrientationChange);
    document.removeEventListener("visibilitychange", onVisibility);
    els.mic.removeEventListener("click", onMic);
    sourceBox.removeEventListener("click", onSource);
    smartSourceBox.removeEventListener("click", onSource);
    layoutBox.removeEventListener("click", onLayout);
    topicBox.removeEventListener("click", onTopicChip);
    topicForm.removeEventListener("submit", onTopicForm);
    setBtn.removeEventListener("click", onSetTopic);
    askStatus.removeEventListener("click", onCancelAsk);
    cancelAsk();
    sendDialog.removeEventListener("click", onDialogClick);
    sendDialog.removeEventListener("close", onDialogClose);
    sendBtn.removeEventListener("click", onSendTv);
    smartEnter.removeEventListener("click", onEnterSmartView);
    smartExit.removeEventListener("click", onExitSmartView);
    captionsOnlyBtn.removeEventListener("click", onCaptionsOnly);
    smartMic.removeEventListener("click", onMic);
    unbindOffline();
    unbindSetup();
    setupOpen.removeEventListener("click", onOpenLocalSetup);
    setupClose.removeEventListener("click", onCloseLocalSetup);
    setupDialog.removeEventListener("click", onSetupDialogClick);
    onCloseLocalSetup();
    typeForm.removeEventListener("submit", onType);
    langList.removeEventListener("click", onLangActions);
    reclaimBtn.removeEventListener("click", onReclaim);
    joinBtn.removeEventListener("click", onJoinPhones);
    joinDialog.removeEventListener("click", onJoinDialogClick);
    joinDialog.removeEventListener("close", onJoinDialogClose);
    copyJoinBtn.removeEventListener("click", onCopyJoin);
    onCloseJoinPhones();
    onCloseSendTv();
    unsubUiLang();
  };
}

const CAPTIONS_ONLY_KEY = "ff-smart-view-captions-only";

function readCaptionsOnlyPref(): boolean {
  try {
    const stored = sessionStorage.getItem(CAPTIONS_ONLY_KEY);
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch {
    /* private mode / blocked storage */
  }
  return true;
}

function writeCaptionsOnlyPref(value: boolean) {
  try {
    sessionStorage.setItem(CAPTIONS_ONLY_KEY, value ? "1" : "0");
  } catch {
    /* private mode / blocked storage */
  }
}

function renderTopicPreview(topic: TopicContent | null, lang: Lang): string {
  if (!hasTopicBody(topic) || !topic) {
    return `<p class="hint">${escapeHtml(t("host.topicEmpty"))}</p>`;
  }
  const title = localized(topic.title, lang);
  const verse = localized(topic.verse, lang);
  return `
    ${title ? `<p class="topic-preview-kicker">${escapeHtml(title)}</p>` : ""}
    ${renderTopicHandout(topic, lang)}
    ${!verse && topic.id === "custom" ? `<p class="hint">${escapeHtml(t("host.noVerse"))}</p>` : ""}
  `;
}
