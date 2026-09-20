import { brandBlock, creditFooter } from "../brand";
import { finalizedLines } from "../caption-history";
import { connectRoom } from "../realtime/client";
import { goto } from "../router";
import { normalizeTopic } from "../topics";
import { emptyState, type ConnStatus, type PeerCounts } from "../types";
import { paintCaptionBoard } from "./caption-board";

export function mountTv(root: HTMLElement, room: string): () => void {
  let state = emptyState(room);
  let peers: PeerCounts = { phones: 0, tvs: 1 };
  let connStatus: ConnStatus = "connecting";

  root.innerHTML = `
    <section class="screen tv-screen">
      <div class="tv-top">
        ${brandBlock(true)}
        <div class="tv-meta">
          <div class="room-pill">Room <strong data-room></strong></div>
          <div class="status-pill"><span class="dot" data-dot></span><span data-status></span></div>
          <button class="ghost" data-home type="button">Leave</button>
        </div>
      </div>
      <aside class="tv-topic" data-topic hidden></aside>
      <main class="tv-board" data-board></main>
      ${creditFooter()}
    </section>
  `;

  const board = root.querySelector("[data-board]") as HTMLElement;
  const topicEl = root.querySelector("[data-topic]") as HTMLElement;
  const roomEl = root.querySelector("[data-room]") as HTMLElement;
  const statusEl = root.querySelector("[data-status]") as HTMLElement;
  const dot = root.querySelector("[data-dot]") as HTMLElement;
  const home = root.querySelector("[data-home]");

  const onHome = () => goto("home");
  home?.addEventListener("click", onHome);

  function render() {
    roomEl.textContent = state.room;
    const phoneNote = peers.phones > 0 ? "Phone connected" : "Waiting for phone";
    statusEl.textContent = state.listening ? `Live · ${phoneNote}` : phoneNote;
    dot.className = `dot ${state.listening ? "listening" : connStatus === "live" ? "live" : "offline"}`;
    paintCaptionBoard(board, topicEl, state);
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

  return () => {
    conn.close();
    home?.removeEventListener("click", onHome);
  };
}
