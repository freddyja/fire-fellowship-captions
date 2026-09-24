import { brandBlock } from "../brand";
import { bindUiLangBar, t, uiLangBarHtml } from "../ui-lang";
import { appendFinalLine, applyFinalLine, finalizedLines } from "../caption-history";
import { connectRoom, type RoomConnection } from "../realtime/client";
import { goto } from "../router";
import { detectSpeechCapability } from "../stt/capability";
import { createWebSpeechProvider, isNonFatalSpeechNote, isSpeechFallbackMessage } from "../stt/web-speech";
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
  isWatchPref,
  LANG_LABEL,
  LANG_SHORT,
  LANGS,
  layoutForWatch,
  sanitizePeerName,
  someoneElseSpeaking,
  speechLocale,
  type CaptionLine,
  type ConnStatus,
  type FloorState,
  type Lang,
  type PeerCounts,
  type WatchPref,
} from "../types";

const micIcon = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
  <rect x="9" y="3" width="6" height="11" rx="3"/>
  <path d="M6 11a6 6 0 0 0 12 0"/>
  <path d="M12 17v4M8 21h8"/>
</svg>
`;

const NAME_KEY = "ff-guest-name";
const CAPTIONS_ONLY_KEY = "ff-join-captions-only";
const WATCH_KEY = "ff-join-watch";
const SPOKEN_KEY = "ff-join-spoken";

export function mountJoin(root: HTMLElement, room: string): () => void {
  const translator = createTranslator();
  const speech = createWebSpeechProvider();
  const stt = detectSpeechCapability();
  let state = emptyState(room);
  let peers: PeerCounts = { phones: 1, tvs: 0, guests: 1 };
  let connStatus: ConnStatus = "connecting";
  let error = "";
  let conn: RoomConnection | null = null;
  let publishEpoch = 0;
  let hydrated = false;
  let wakeLock: WakeLockSentinel | null = null;
  let liveInterim = "";
  let peerId: string | null = null;
  let floor: FloorState = emptyFloor();
  let sourceLang: Lang = readSpokenPref();
  let watch: WatchPref = readWatchPref();
  let displayName = readGuestName();
  let captionsOnly = readCaptionsOnlyPref();
  let entered = false;
  let lastCaptionWasMock = false;
  let typeFallback = stt.preferType;
  let pendingFinal = "";

  const push = () =>
    conn?.push({
      ...state,
      sourceLang,
      floor,
      listening: state.listening,
    });

  root.innerHTML = `
    <section class="screen join-setup" data-join-setup>
      ${brandBlock(true)}
      ${uiLangBarHtml("join-ui-lang-label")}
      <p class="lede join-setup-lead"><span data-i18n="join.roomWord">Room</span> <strong data-setup-room></strong><span data-i18n="join.leadTail">. Answer two questions, then join.</span></p>
      <fieldset class="join-setup-q">
        <legend id="join-spoken-q" data-i18n="join.spokenQ">What language are you speaking?</legend>
        <div class="chips" data-setup-source role="group" aria-labelledby="join-spoken-q"></div>
      </fieldset>
      <fieldset class="join-setup-q">
        <legend id="join-watch-q" data-i18n="join.watchQ">What language do you want to watch?</legend>
        <div class="chips join-setup-watch" data-setup-watch role="group" aria-labelledby="join-watch-q"></div>
        <p class="join-watch-note" data-i18n="join.watchNoteLong">This phone only. It does not change the host, the TV, or other phones.</p>
      </fieldset>
      <p class="hint" data-i18n="join.hint">Spoken is for your mic and Type + Send. Watch is the caption language on this phone only.</p>
      <label class="join-name">
        <span data-i18n="join.yourName">Your name</span>
        <input data-setup-name maxlength="24" autocomplete="name" data-i18n-placeholder="join.guestPlaceholder" placeholder="Guest" enterkeyhint="done" />
      </label>
      <button class="primary join-setup-go" data-join-continue type="button" data-i18n="join.join">Join</button>
      <button class="ghost" data-setup-home type="button" data-i18n="chrome.leave">Leave</button>
    </section>
    <section class="screen join-screen" data-join-screen hidden>
      <div class="tv-top">
        ${brandBlock(true)}
        <div class="tv-meta">
          <div class="room-pill"><span data-i18n="chrome.room">Room</span> <strong data-room></strong></div>
          <div class="status-pill"><span class="dot" data-dot></span><span data-status></span></div>
          <button class="ghost" data-home type="button" data-i18n="chrome.leave">Leave</button>
        </div>
      </div>
      <p class="floor-banner" data-floor></p>
      <div class="join-main">
        <aside class="tv-topic" data-topic hidden></aside>
        <main class="tv-board" data-board></main>
      </div>
      <div class="join-dock">
        <p class="smart-view-tip" data-stt-hint></p>
        <label class="join-name">
          <span data-i18n="join.yourName">Your name</span>
          <input data-name maxlength="24" autocomplete="name" data-i18n-placeholder="join.guestPlaceholder" placeholder="Guest" enterkeyhint="done" />
        </label>
        <div class="join-prefs">
          <div class="join-pref">
            <p class="control-label" data-i18n="join.spoken">Spoken</p>
            <div class="chips" data-source role="group" data-i18n-aria="join.spokenAria" aria-label="Spoken language"></div>
          </div>
          <div class="join-pref">
            <p class="control-label" data-i18n="join.watch">Watch</p>
            <div class="chips" data-watch-choices role="group" data-i18n-aria="join.watchAria" aria-label="Watch"></div>
            <p class="join-watch-note" data-i18n="join.phoneOnly">This phone only</p>
          </div>
        </div>
        <div class="smart-view-controls join-actions">
          <button class="chip smart-view-captions-only" data-captions-only type="button" aria-pressed="false" data-i18n="join.captionsOnly">
            Captions only
          </button>
          <button class="smart-view-mic" data-mic type="button" aria-pressed="false">
            ${micIcon}
            <small data-mic-label>Start</small>
          </button>
        </div>
        <p class="hint" data-error></p>
        <form class="typed-caption join-type" data-type>
          <input name="caption" autocomplete="off" autocorrect="on" autocapitalize="sentences" enterkeyhint="send" data-i18n-placeholder="join.typeCaption" placeholder="Type a caption" />
          <button class="primary" type="submit" data-i18n="chrome.send">Send</button>
        </form>
      </div>
    </section>
  `;

  const sourceBox = root.querySelector("[data-source]") as HTMLElement;
  sourceBox.innerHTML = LANGS.map(
    (lang) => `<button class="chip" type="button" data-lang="${lang}">${LANG_SHORT[lang]} ${LANG_LABEL[lang]}</button>`,
  ).join("");
  const watchBox = root.querySelector("[data-watch-choices]") as HTMLElement;
  watchBox.innerHTML = `
    <button class="chip" type="button" data-watch="en" aria-pressed="false" data-i18n="join.enOnly">EN only</button>
    <button class="chip" type="button" data-watch="es" aria-pressed="false" data-i18n="join.esOnly">ES only</button>
    <button class="chip" type="button" data-watch="pt" aria-pressed="false" data-i18n="join.ptOnly">PT only</button>
    <button class="chip" type="button" data-watch="all" aria-pressed="false" data-i18n="join.allThree">All three</button>
  `;

  const typeForm = root.querySelector("[data-type]") as HTMLFormElement;
  const typeInput = typeForm.elements.namedItem("caption") as HTMLInputElement;
  const typeSend = typeForm.querySelector("button[type='submit']") as HTMLButtonElement;
  const captionsOnlyBtn = root.querySelector("[data-captions-only]") as HTMLButtonElement;
  const screenEl = root.querySelector("[data-join-screen]") as HTMLElement;
  const setupEl = root.querySelector("[data-join-setup]") as HTMLElement;
  const setupSource = root.querySelector("[data-setup-source]") as HTMLElement;
  const setupWatch = root.querySelector("[data-setup-watch]") as HTMLElement;
  const setupName = root.querySelector("[data-setup-name]") as HTMLInputElement;
  const setupContinue = root.querySelector("[data-join-continue]") as HTMLButtonElement;
  const board = root.querySelector("[data-board]") as HTMLElement;
  const topicEl = root.querySelector("[data-topic]") as HTMLElement;
  const nameInput = root.querySelector("[data-name]") as HTMLInputElement;
  const sttHint = root.querySelector("[data-stt-hint]") as HTMLElement;
  const landscapeMq = window.matchMedia("(orientation: landscape)");
  nameInput.value = displayName;
  setupName.value = displayName === "Guest" ? "" : displayName;
  (root.querySelector("[data-setup-room]") as HTMLElement).textContent = room;
  setupSource.innerHTML = LANGS.map(
    (lang) =>
      `<button class="chip" type="button" data-setup-lang="${lang}" aria-pressed="false">${LANG_SHORT[lang]} ${LANG_LABEL[lang]}</button>`,
  ).join("");
  setupWatch.innerHTML = `
    <button class="chip" type="button" data-setup-watch="en" aria-pressed="false" data-i18n="join.enOnly">EN only</button>
    <button class="chip" type="button" data-setup-watch="es" aria-pressed="false" data-i18n="join.esOnly">ES only</button>
    <button class="chip" type="button" data-setup-watch="pt" aria-pressed="false" data-i18n="join.ptOnly">PT only</button>
    <button class="chip" type="button" data-setup-watch="all" aria-pressed="false" data-i18n="join.allThree">All three</button>
  `;

  const els = {
    room: root.querySelector("[data-room]") as HTMLElement,
    status: root.querySelector("[data-status]") as HTMLElement,
    dot: root.querySelector("[data-dot]") as HTMLElement,
    mic: root.querySelector("[data-mic]") as HTMLButtonElement,
    micLabel: root.querySelector("[data-mic-label]") as HTMLElement,
    error: root.querySelector("[data-error]") as HTMLElement,
    floor: root.querySelector("[data-floor]") as HTMLElement,
  };

  const syncOrientation = () => {
    const landscape = landscapeMq.matches || window.innerWidth > window.innerHeight;
    screenEl.dataset.orientation = landscape ? "landscape" : "portrait";
  };

  function sttHintText(): string {
    if (stt.insecure) return t("join.httpsHint");
    if (!stt.canListen) return t("join.chromeAndroidHint");
    if (stt.preferType) return t("join.iphoneTypeHint");
    return t("join.sameMeetingHint");
  }

  function renderDynamic() {
    const holding = isFloorHolder(floor, peerId);
    const blocked = floorHeldByOther(floor, peerId);
    const showMic = stt.canListen;
    els.room.textContent = state.room;
    const guestNote = peers.guests > 0 ? `${peers.guests} ${t("host.onPhones")}` : t("join.joined");
    const tvNote = peers.tvs > 0 ? ` · ${t("host.tvConnected")} (${peers.tvs})` : "";
    const connNote =
      connStatus === "live" ? `${guestNote}${tvNote}` : connStatus === "connecting" ? t("chrome.connecting") : t("chrome.reconnecting");
    els.status.textContent = holding && state.listening ? `${t("chrome.listening")} · ${connNote}` : connNote;
    els.dot.className = `dot ${holding && state.listening ? "listening" : connStatus === "live" ? "live" : "offline"}`;
    els.mic.hidden = !showMic;
    els.mic.classList.toggle("hot", holding && state.listening);
    els.mic.disabled = blocked;
    els.mic.setAttribute("aria-pressed", String(holding && state.listening));
    els.micLabel.textContent = holding ? t("chrome.stop") : blocked ? t("chrome.wait") : t("chrome.start");
    if (blocked) {
      els.floor.textContent = someoneElseSpeaking(floor);
    } else if (holding && state.listening) {
      els.floor.textContent = typeFallback ? t("join.floorType") : t("join.floorSpeaking");
    } else if (holding) {
      els.floor.textContent = t("join.floorHolding");
    } else if (!showMic) {
      els.floor.textContent = t("join.floorTypeOnly");
    } else {
      els.floor.textContent = t("join.floorFree");
    }
    els.floor.hidden = false;
    sttHint.textContent = sttHintText();
    const extra = lastCaptionWasMock ? t("chrome.offlineLimited") : "";
    els.error.textContent = [error, extra].filter(Boolean).join(" ");
    screenEl.classList.toggle("is-captions-only", captionsOnly);
    captionsOnlyBtn.classList.toggle("active", captionsOnly);
    captionsOnlyBtn.setAttribute("aria-pressed", String(captionsOnly));
    typeForm.classList.toggle("is-primary", typeFallback || !showMic);
    typeInput.disabled = blocked;
    typeSend.disabled = blocked;
    typeInput.placeholder = blocked
      ? t("join.waitPlaceholder")
      : typeFallback || !showMic
        ? t("join.typeCaption")
        : t("join.orTypeCaption");
    for (const btn of sourceBox.querySelectorAll<HTMLButtonElement>("[data-lang]")) {
      btn.classList.toggle("active", btn.dataset.lang === sourceLang);
    }
    for (const btn of watchBox.querySelectorAll<HTMLButtonElement>("[data-watch]")) {
      const on = btn.dataset.watch === watch;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    }
    // Watch paints this phone only. Room layout stays on state and is what we push.
    screenEl.dataset.watch = watch;
    screenEl.dataset.roomLayout = state.layout;
    paintCaptionBoard(
      board,
      topicEl,
      { ...state, layout: layoutForWatch(watch), lines: finalizedLines(state.lines) },
      liveInterim && holding ? { text: liveInterim, sourceLang, speaker: captionSpeaker(floor.holderName || displayName, "guest") } : null,
    );
    if (captionsOnly) {
      topicEl.hidden = true;
      topicEl.innerHTML = "";
    }
    syncOrientation();
  }

  const releaseWake = () => {
    void wakeLock?.release();
    wakeLock = null;
  };

  const requestWake = async () => {
    try {
      wakeLock = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      /* not available on many iPhones / background tabs */
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
    if (!stt.canListen) {
      typeFallback = true;
      typeInput.focus();
      renderDynamic();
      return;
    }
    if (isFloorHolder(floor, peerId)) {
      stopLocalMic();
      pendingFinal = "";
      void (async () => {
        await conn?.releaseFloor();
        renderDynamic();
        push();
      })();
      return;
    }
    if (floorHeldByOther(floor, peerId)) {
      error = someoneElseSpeaking(floor);
      renderDynamic();
      return;
    }
    // iOS Safari only runs SpeechRecognition.start() on the click stack.
    // An await (floor claim) before start() makes the mic a silent no-op.
    // Prime es-ES / pt-BR on the reused iOS recognizer before start().
    speech.setLang(speechLocale(sourceLang), true);
    speech.start();
    void (async () => {
      const ok = (await conn?.claimFloor(displayName)) ?? false;
      if (!ok) {
        speech.stop();
        pendingFinal = "";
        error = someoneElseSpeaking(floor);
        renderDynamic();
        return;
      }
      if (micFailed(error) && !isNonFatalSpeechNote(error)) {
        stopLocalMic();
        typeFallback = true;
        typeInput.focus();
        state = { ...state, listening: false, sourceLang, floor };
        renderDynamic();
        return;
      }
      void requestWake();
      state = { ...state, listening: true, sourceLang, floor };
      renderDynamic();
      push();
      const queued = pendingFinal.trim();
      pendingFinal = "";
      if (queued) queuePublish(queued);
    })();
  };

  async function publishFinal(text: string, coalesce = true) {
    const spoken = text.trim();
    if (!spoken) return;
    // Spoken at the moment this line was heard. A later chip tap must not
    // relabel it, and short Spanish ("mi esposa") has no detectLang hints.
    const spokenAs = sourceLang;
    if (floorHeldByOther(floor, peerId)) {
      error = someoneElseSpeaking(floor);
      renderDynamic();
      return;
    }
    if (!isFloorHolder(floor, peerId)) {
      const ok = (await conn?.claimFloor(displayName)) ?? false;
      if (!ok || !isFloorHolder(floor, peerId)) {
        error = someoneElseSpeaking(floor);
        renderDynamic();
        return;
      }
      state = { ...state, listening: true, sourceLang, floor };
      push();
    }
    error = "";
    liveInterim = "";
    const speaker = captionSpeaker(floor.holderName || displayName, "guest");
    renderDynamic();
    const epoch = publishEpoch;
    const from = detectLang(spoken, spokenAs);
    const translated = await translateAll(translator, spoken, from);
    if (epoch !== publishEpoch) return;
    lastCaptionWasMock = translator.id === "mock";
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
    state = { ...state, lines, sourceLang: spokenAs, floor, listening: true };
    renderDynamic();
    push();
  }

  let publishQueue: Promise<void> = Promise.resolve();
  const queuePublish = (text: string, coalesce = true) => {
    publishQueue = publishQueue.then(() => publishFinal(text, coalesce)).catch(() => undefined);
  };

  speech.onResult = (result) => {
    error = "";
    if (result.isFinal) {
      if (isFloorHolder(floor, peerId)) {
        pendingFinal = "";
        queuePublish(result.text);
      } else if (!floorHeldByOther(floor, peerId)) {
        pendingFinal = result.text;
      } else {
        error = someoneElseSpeaking(floor);
        renderDynamic();
      }
      return;
    }
    if (!isFloorHolder(floor, peerId)) return;
    const next = result.text.trim();
    if (next === liveInterim) return;
    liveInterim = next;
    renderDynamic();
  };
  speech.onError = (message) => {
    error = message;
    typeFallback = true;
    // no-speech is a pause or a WebKit miss. Keep the mic up and show the note.
    if (isNonFatalSpeechNote(message)) {
      renderDynamic();
      return;
    }
    pendingFinal = "";
    stopLocalMic();
    typeInput.focus();
    renderDynamic();
  };

  const onWatch = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-watch]");
    if (!btn?.dataset.watch || !isWatchPref(btn.dataset.watch)) return;
    watch = btn.dataset.watch;
    writeWatchPref(watch);
    renderDynamic();
  };

  const onSource = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-lang]");
    if (!btn?.dataset.lang) return;
    const next = btn.dataset.lang as Lang;
    if (!isLang(next)) return;
    sourceLang = next;
    writeSpokenPref(sourceLang);
    speech.setLang(speechLocale(sourceLang), true);
    if (isFloorHolder(floor, peerId)) {
      state = { ...state, sourceLang };
      push();
    }
    renderDynamic();
  };

  const onCaptionsOnly = () => {
    captionsOnly = !captionsOnly;
    writeCaptionsOnlyPref(captionsOnly);
    renderDynamic();
  };

  const onName = () => {
    displayName = sanitizePeerName(nameInput.value, "Guest");
    writeGuestName(displayName);
    nameInput.value = displayName;
    if (isFloorHolder(floor, peerId)) void conn?.claimFloor(displayName);
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
      const text = typeInput.value.trim();
      if (!text) return;
      if (floorHeldByOther(floor, peerId)) {
        error = someoneElseSpeaking(floor);
        renderDynamic();
        return;
      }
      if (!isFloorHolder(floor, peerId)) {
        const ok = (await conn?.claimFloor(displayName)) ?? false;
        if (!ok) {
          error = someoneElseSpeaking(floor);
          renderDynamic();
          return;
        }
        state = { ...state, listening: true, sourceLang, floor };
        push();
      }
      typeInput.value = "";
      queuePublish(text, false);
    })();
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible" && state.listening) void requestWake();
  };

  const onOrientationChange = () => syncOrientation();
  landscapeMq.addEventListener("change", onOrientationChange);
  window.addEventListener("resize", onOrientationChange);
  window.addEventListener("orientationchange", onOrientationChange);
  syncOrientation();

  const paintSetup = () => {
    for (const btn of setupSource.querySelectorAll<HTMLButtonElement>("[data-setup-lang]")) {
      const on = btn.dataset.setupLang === sourceLang;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    }
    for (const btn of setupWatch.querySelectorAll<HTMLButtonElement>("[data-setup-watch]")) {
      const on = btn.dataset.setupWatch === watch;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    }
  };

  const onSetupSource = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-setup-lang]");
    if (!btn?.dataset.setupLang || !isLang(btn.dataset.setupLang)) return;
    sourceLang = btn.dataset.setupLang;
    writeSpokenPref(sourceLang);
    speech.setLang(speechLocale(sourceLang), true);
    paintSetup();
  };

  const onSetupWatch = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-setup-watch]");
    if (!btn?.dataset.setupWatch || !isWatchPref(btn.dataset.setupWatch)) return;
    watch = btn.dataset.setupWatch;
    writeWatchPref(watch);
    paintSetup();
  };

  const onSetupName = () => {
    displayName = sanitizePeerName(setupName.value, "Guest");
    writeGuestName(displayName);
  };

  const onSetupHome = () => {
    goto("home");
  };

  const enterRoom = () => {
    if (entered) return;
    onSetupName();
    writeSpokenPref(sourceLang);
    writeWatchPref(watch);
    speech.setLang(speechLocale(sourceLang), true);
    nameInput.value = displayName;
    entered = true;
    setupEl.hidden = true;
    screenEl.hidden = false;
    conn = connectRoom({
      room,
      role: "guest",
      name: displayName,
      onJoined(info) {
        peerId = info.peerId;
        floor = info.floor ?? floor;
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
        } else if (isFloorHolder(next, peerId) && error.startsWith("Someone else is speaking")) {
          error = "";
        }
        state = { ...state, floor: next };
        renderDynamic();
      },
      onState(next) {
        const holding = keepsLocalCaptions(floor, next.floor, peerId);
        floor = reconcileFloor(floor, next.floor, peerId);
        state = {
          ...next,
          room,
          floor,
          sourceLang,
          listening: holding ? state.listening : Boolean(next.listening),
          lines: holding ? state.lines : finalizedLines(next.lines ?? []),
        };
        if (!hydrated) hydrated = true;
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
  };

  els.mic.addEventListener("click", onMic);
  document.addEventListener("visibilitychange", onVisibility);
  sourceBox.addEventListener("click", onSource);
  watchBox.addEventListener("click", onWatch);
  captionsOnlyBtn.addEventListener("click", onCaptionsOnly);
  nameInput.addEventListener("change", onName);
  root.querySelector("[data-home]")?.addEventListener("click", onHome);
  typeForm.addEventListener("submit", onType);
  setupSource.addEventListener("click", onSetupSource);
  setupWatch.addEventListener("click", onSetupWatch);
  setupName.addEventListener("change", onSetupName);
  setupContinue.addEventListener("click", enterRoom);
  root.querySelector("[data-setup-home]")?.addEventListener("click", onSetupHome);
  paintSetup();
  const unbindLang = bindUiLangBar(root, () => {
    paintSetup();
    renderDynamic();
  });

  return () => {
    speech.stop();
    releaseWake();
    conn?.close();
    landscapeMq.removeEventListener("change", onOrientationChange);
    window.removeEventListener("resize", onOrientationChange);
    window.removeEventListener("orientationchange", onOrientationChange);
    document.removeEventListener("visibilitychange", onVisibility);
    els.mic.removeEventListener("click", onMic);
    sourceBox.removeEventListener("click", onSource);
    watchBox.removeEventListener("click", onWatch);
    captionsOnlyBtn.removeEventListener("click", onCaptionsOnly);
    nameInput.removeEventListener("change", onName);
    typeForm.removeEventListener("submit", onType);
    setupSource.removeEventListener("click", onSetupSource);
    setupWatch.removeEventListener("click", onSetupWatch);
    setupName.removeEventListener("change", onSetupName);
    setupContinue.removeEventListener("click", enterRoom);
    unbindLang();
  };
}

function micFailed(message: string): boolean {
  return isSpeechFallbackMessage(message);
}

function readGuestName(): string {
  try {
    return sanitizePeerName(sessionStorage.getItem(NAME_KEY), "Guest");
  } catch {
    return "Guest";
  }
}

function writeGuestName(value: string) {
  try {
    sessionStorage.setItem(NAME_KEY, value);
  } catch {
    /* private mode / blocked storage */
  }
}

function readCaptionsOnlyPref(): boolean {
  try {
    const stored = sessionStorage.getItem(CAPTIONS_ONLY_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    /* private mode / blocked storage */
  }
  return false;
}

function writeCaptionsOnlyPref(value: boolean) {
  try {
    sessionStorage.setItem(CAPTIONS_ONLY_KEY, value ? "1" : "0");
  } catch {
    /* private mode / blocked storage */
  }
}

function readWatchPref(): WatchPref {
  try {
    const stored = sessionStorage.getItem(WATCH_KEY);
    if (isWatchPref(stored)) return stored;
  } catch {
    /* private mode / blocked storage */
  }
  return "all";
}

function writeWatchPref(value: WatchPref) {
  try {
    sessionStorage.setItem(WATCH_KEY, value);
  } catch {
    /* private mode / blocked storage */
  }
}

function readSpokenPref(): Lang {
  try {
    const stored = sessionStorage.getItem(SPOKEN_KEY);
    if (isLang(stored)) return stored;
  } catch {
    /* private mode / blocked storage */
  }
  return "en";
}

function writeSpokenPref(value: Lang) {
  try {
    sessionStorage.setItem(SPOKEN_KEY, value);
  } catch {
    /* private mode / blocked storage */
  }
}
