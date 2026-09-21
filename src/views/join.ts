import { brandBlock, creditFooter } from "../brand";
import { appendFinalLine, applyFinalLine, finalizedLines } from "../caption-history";
import { connectRoom, type RoomConnection } from "../realtime/client";
import { goto } from "../router";
import { createWebSpeechProvider } from "../stt/web-speech";
import { createTranslator, detectLang, translateAll } from "../translate";
import { paintCaptionBoard } from "./caption-board";
import {
  emptyFloor,
  emptyState,
  floorHeldByOther,
  isFloorHolder,
  isLang,
  LANG_LABEL,
  LANG_SHORT,
  LANGS,
  sanitizePeerName,
  someoneElseSpeaking,
  speechLocale,
  type CaptionLine,
  type ConnStatus,
  type FloorState,
  type Lang,
  type PeerCounts,
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

export function mountJoin(root: HTMLElement, room: string): () => void {
  const translator = createTranslator();
  const speech = createWebSpeechProvider();
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
  let sourceLang: Lang = "en";
  let displayName = readGuestName();
  let captionsOnly = readCaptionsOnlyPref();
  let lastCaptionWasMock = false;

  const push = () =>
    conn?.push({
      ...state,
      sourceLang,
      floor,
      listening: state.listening,
    });

  root.innerHTML = `
    <section class="screen phone-screen is-smart-view is-join">
      <div class="smart-view-layer">
        <section class="screen tv-screen smart-view-captions join-captions">
          <div class="tv-top">
            ${brandBlock(true)}
            <div class="tv-meta">
              <div class="room-pill">Room <strong data-room></strong></div>
              <div class="status-pill"><span class="dot" data-dot></span><span data-status></span></div>
              <button class="ghost" data-home type="button">Leave</button>
            </div>
          </div>
          <p class="floor-banner" data-floor></p>
          <aside class="tv-topic" data-topic hidden></aside>
          <main class="tv-board" data-board></main>
          <div class="smart-view-dock join-dock">
            <p class="smart-view-tip">Same meeting as the Fold and the TV. One brother speaks at a time.</p>
            <label class="join-name">
              <span>Your name</span>
              <input data-name maxlength="24" autocomplete="name" placeholder="Brother" />
            </label>
            <div>
              <p class="control-label">Spoken language</p>
              <div class="chips" data-source></div>
            </div>
            <div class="smart-view-controls">
              <button class="chip smart-view-captions-only" data-captions-only type="button" aria-pressed="false">
                Captions only
              </button>
              <button class="smart-view-mic" data-mic type="button" aria-pressed="false">
                ${micIcon}
                <small data-mic-label>Start</small>
              </button>
            </div>
            <p class="hint" data-error></p>
            <form class="typed-caption" data-type>
              <input name="caption" autocomplete="off" enterkeyhint="send" placeholder="Or type a caption" />
              <button class="primary" type="submit">Send</button>
            </form>
            ${creditFooter()}
          </div>
        </section>
      </div>
    </section>
  `;

  const sourceBox = root.querySelector("[data-source]") as HTMLElement;
  sourceBox.innerHTML = LANGS.map(
    (lang) => `<button class="chip" type="button" data-lang="${lang}">${LANG_SHORT[lang]} ${LANG_LABEL[lang]}</button>`,
  ).join("");

  const typeForm = root.querySelector("[data-type]") as HTMLFormElement;
  const captionsOnlyBtn = root.querySelector("[data-captions-only]") as HTMLButtonElement;
  const captionsEl = root.querySelector(".join-captions") as HTMLElement;
  const board = root.querySelector("[data-board]") as HTMLElement;
  const topicEl = root.querySelector("[data-topic]") as HTMLElement;
  const nameInput = root.querySelector("[data-name]") as HTMLInputElement;
  const landscapeMq = window.matchMedia("(orientation: landscape)");
  nameInput.value = displayName;

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
    captionsEl.dataset.orientation = landscape ? "landscape" : "portrait";
  };

  function renderDynamic() {
    const holding = isFloorHolder(floor, peerId);
    const blocked = floorHeldByOther(floor, peerId);
    els.room.textContent = state.room;
    const guestNote = peers.guests > 0 ? `${peers.guests} on phones` : "Joined";
    const tvNote = peers.tvs > 0 ? ` · TV connected (${peers.tvs})` : "";
    const connNote =
      connStatus === "live" ? `${guestNote}${tvNote}` : connStatus === "connecting" ? "Connecting…" : "Reconnecting…";
    els.status.textContent = holding && state.listening ? `Listening · ${connNote}` : connNote;
    els.dot.className = `dot ${holding && state.listening ? "listening" : connStatus === "live" ? "live" : "offline"}`;
    els.mic.classList.toggle("hot", holding && state.listening);
    els.mic.disabled = blocked;
    els.mic.setAttribute("aria-pressed", String(holding && state.listening));
    els.micLabel.textContent = holding && state.listening ? "Stop" : blocked ? "Wait" : "Start";
    if (blocked) {
      els.floor.textContent = someoneElseSpeaking(floor);
      els.floor.hidden = false;
    } else if (holding && state.listening) {
      els.floor.textContent = "You're speaking — captions go to every phone and the TV.";
      els.floor.hidden = false;
    } else if (holding) {
      els.floor.textContent = "You have the mic.";
      els.floor.hidden = false;
    } else {
      els.floor.textContent = "Mic is free. Pick a spoken language, then Start.";
      els.floor.hidden = false;
    }
    els.error.textContent = error || (lastCaptionWasMock ? "Offline translate (limited phrases)." : "");
    captionsEl.classList.toggle("is-captions-only", captionsOnly);
    captionsOnlyBtn.classList.toggle("active", captionsOnly);
    captionsOnlyBtn.setAttribute("aria-pressed", String(captionsOnly));
    for (const btn of sourceBox.querySelectorAll<HTMLButtonElement>("[data-lang]")) {
      btn.classList.toggle("active", btn.dataset.lang === sourceLang);
    }
    paintCaptionBoard(
      board,
      topicEl,
      { ...state, lines: finalizedLines(state.lines) },
      liveInterim && holding ? { text: liveInterim, sourceLang } : null,
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
    void (async () => {
      error = "";
      if (state.listening) {
        stopLocalMic();
        await conn?.releaseFloor();
        renderDynamic();
        push();
        return;
      }
      if (floorHeldByOther(floor, peerId)) {
        error = someoneElseSpeaking(floor);
        renderDynamic();
        return;
      }
      const ok = (await conn?.claimFloor(displayName)) ?? false;
      if (!ok) {
        error = someoneElseSpeaking(floor);
        renderDynamic();
        return;
      }
      speech.setLang(speechLocale(sourceLang));
      speech.start();
      void requestWake();
      state = { ...state, listening: true, sourceLang, floor };
      renderDynamic();
      push();
    })();
  };

  async function publishFinal(text: string, coalesce = true) {
    const spoken = text.trim();
    if (!spoken) return;
    if (!isFloorHolder(floor, peerId)) {
      error = someoneElseSpeaking(floor);
      renderDynamic();
      return;
    }
    liveInterim = "";
    renderDynamic();
    const epoch = publishEpoch;
    const from = detectLang(spoken, sourceLang);
    const translated = await translateAll(translator, spoken, from);
    if (epoch !== publishEpoch) return;
    lastCaptionWasMock = translator.id === "mock";
    const line: CaptionLine = {
      id: crypto.randomUUID(),
      isFinal: true,
      text: translated,
      at: Date.now(),
    };
    const lines = coalesce
      ? applyFinalLine(state.lines, line, from)
      : appendFinalLine(state.lines, line);
    state = { ...state, lines, sourceLang, floor, listening: true };
    renderDynamic();
    push();
  }

  speech.onResult = (result) => {
    error = "";
    if (result.isFinal) {
      void publishFinal(result.text);
      return;
    }
    const next = result.text.trim();
    if (next === liveInterim) return;
    liveInterim = next;
    renderDynamic();
  };
  speech.onError = (message) => {
    error = message;
    if (message.includes("Microphone blocked") || message.includes("no Web Speech")) {
      stopLocalMic();
      void conn?.releaseFloor();
      typeForm.hidden = false;
      renderDynamic();
      push();
      return;
    }
    renderDynamic();
  };

  const onSource = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-lang]");
    if (!btn?.dataset.lang) return;
    const next = btn.dataset.lang as Lang;
    if (!isLang(next)) return;
    sourceLang = next;
    speech.setLang(speechLocale(sourceLang));
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
    displayName = sanitizePeerName(nameInput.value, "Brother");
    writeGuestName(displayName);
    nameInput.value = displayName;
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
        const ok = (await conn?.claimFloor(displayName)) ?? false;
        if (!ok) {
          error = someoneElseSpeaking(floor);
          renderDynamic();
          return;
        }
        state = { ...state, listening: true, sourceLang, floor };
        push();
      }
      input.value = "";
      void publishFinal(text, false);
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

  els.mic.addEventListener("click", onMic);
  document.addEventListener("visibilitychange", onVisibility);
  sourceBox.addEventListener("click", onSource);
  captionsOnlyBtn.addEventListener("click", onCaptionsOnly);
  nameInput.addEventListener("change", onName);
  root.querySelector("[data-home]")?.addEventListener("click", onHome);
  typeForm.addEventListener("submit", onType);

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
      const lost = state.listening && peerId && next.holderId !== peerId;
      floor = next;
      if (lost) {
        publishEpoch += 1;
        stopLocalMic();
        error = someoneElseSpeaking(next);
      }
      state = { ...state, floor: next };
      renderDynamic();
    },
    onState(next) {
      const holding = isFloorHolder(floor, peerId) || isFloorHolder(next.floor, peerId);
      floor = next.floor ?? floor;
      state = {
        ...next,
        room,
        floor,
        sourceLang: holding ? sourceLang : isLang(next.sourceLang) ? next.sourceLang : sourceLang,
        listening: holding ? state.listening : Boolean(next.listening),
        lines: holding ? state.lines : finalizedLines(next.lines ?? []),
      };
      if (!hydrated) {
        hydrated = true;
        if (isLang(next.sourceLang) && !holding) sourceLang = next.sourceLang;
      }
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
    captionsOnlyBtn.removeEventListener("click", onCaptionsOnly);
    nameInput.removeEventListener("change", onName);
    typeForm.removeEventListener("submit", onType);
  };
}

function readGuestName(): string {
  try {
    return sanitizePeerName(sessionStorage.getItem(NAME_KEY), "Brother");
  } catch {
    return "Brother";
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
