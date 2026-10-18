import { brandBlock } from "../brand";
import { applyI18n, t } from "../ui-lang";
import { finalizedLines } from "../caption-history";
import { connectRoom } from "../realtime/client";
import { goto } from "../router";
import { normalizeTopic } from "../topics";
import { LANG_LABEL, LANG_SHORT, emptyState, langsForLayout, type ConnStatus, type Layout, type PeerCounts } from "../types";
import { paintCaptionBoard } from "./caption-board";

/** How long "Tap again to leave" stays armed on the TV. */
const LEAVE_ARM_MS = 4000;

export function mountTv(root: HTMLElement, room: string, lang?: Layout): () => void {
  let state = emptyState(room);
  let peers: PeerCounts = { phones: 0, tvs: 1, guests: 0 };
  let connStatus: ConnStatus = "connecting";
  const langLock = lang;

  root.innerHTML = `
    <section class="screen tv-screen${langLock ? ` is-lang-lock is-lang-lock-${langsForLayout(langLock).length}` : ""}">
      <div class="tv-top">
        ${brandBlock(true)}
        <div class="tv-meta">
          <div class="room-pill"><span data-i18n="chrome.room">Room</span> <strong data-room></strong></div>
          <div class="room-pill" data-lang-pill hidden></div>
          <div class="status-pill"><span class="dot" data-dot></span><span data-status></span></div>
          <button class="ghost tv-leave" data-home type="button" data-i18n="chrome.leave" title="Leave this TV view">Leave</button>
        </div>
      </div>
      <aside class="tv-topic" data-topic hidden></aside>
      <main class="tv-board" data-board></main>
    </section>
  `;

  const board = root.querySelector("[data-board]") as HTMLElement;
  const topicEl = root.querySelector("[data-topic]") as HTMLElement;
  const roomEl = root.querySelector("[data-room]") as HTMLElement;
  const langPill = root.querySelector("[data-lang-pill]") as HTMLElement;
  const statusEl = root.querySelector("[data-status]") as HTMLElement;
  const dot = root.querySelector("[data-dot]") as HTMLElement;
  const home = root.querySelector("[data-home]") as HTMLButtonElement | null;

  // A TV remote or a stray tap should not end the meeting view: Leave needs a second tap.
  let leaveArmed = false;
  let leaveTimer = 0;
  const disarmLeave = () => {
    leaveArmed = false;
    window.clearTimeout(leaveTimer);
    if (home) {
      home.classList.remove("is-armed");
      home.textContent = t("chrome.leave");
    }
  };
  const onHome = () => {
    if (!leaveArmed) {
      leaveArmed = true;
      if (home) {
        home.classList.add("is-armed");
        home.textContent = t("tv.leaveConfirm");
      }
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(disarmLeave, LEAVE_ARM_MS);
      return;
    }
    disarmLeave();
    goto("home");
  };
  home?.addEventListener("click", onHome);

  function render() {
    roomEl.textContent = state.room;
    if (langLock) {
      langPill.hidden = false;
      const locked = langsForLayout(langLock);
      langPill.textContent =
        locked.length === 1 ? `${LANG_SHORT[locked[0]]} · ${LANG_LABEL[locked[0]]}` : locked.map((l) => LANG_SHORT[l]).join(" | ");
    } else {
      langPill.hidden = true;
      langPill.textContent = "";
    }
    const phoneNote =
      state.listening && state.floor?.holderName
        ? `${state.floor.holderName} ${t("tv.speaking")}`
        : peers.phones > 0
          ? peers.guests > 0
            ? `${t("tv.phonesConnected")} (${peers.phones})`
            : t("tv.phoneConnected")
          : t("tv.waiting");
    statusEl.textContent = state.listening ? `${t("tv.live")} · ${phoneNote}` : phoneNote;
    dot.className = `dot ${state.listening ? "listening" : connStatus === "live" ? "live" : "offline"}`;
    paintCaptionBoard(
      board,
      topicEl,
      langLock ? { ...state, layout: langLock, topic: null } : state,
    );
  }

  const conn = connectRoom({
    room,
    role: "tv",
    onState(next) {
      state = {
        ...next,
        topic: normalizeTopic(next.topic),
        lines: finalizedLines(next.lines ?? []),
      };
      render();
    },
    onPeers(next) {
      peers = next;
      render();
    },
    onStatus(status) {
      connStatus = status;
      render();
    },
  });

  render();
  applyI18n(root);

  return () => {
    conn.close();
    window.clearTimeout(leaveTimer);
    home?.removeEventListener("click", onHome);
  };
}
