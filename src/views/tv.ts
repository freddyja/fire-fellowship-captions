import { brandBlock } from "../brand";
import { connectRoom } from "../realtime/client";
import { goto } from "../router";
import {
  emptyState,
  LANG_LABEL,
  LANG_SHORT,
  langsForLayout,
  type CaptionLine,
  type ConnStatus,
  type Lang,
  type PeerCounts,
} from "../types";

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
      <main class="tv-board" data-board></main>
    </section>
  `;

  const board = root.querySelector("[data-board]") as HTMLElement;
  const roomEl = root.querySelector("[data-room]") as HTMLElement;
  const statusEl = root.querySelector("[data-status]") as HTMLElement;
  const dot = root.querySelector("[data-dot]") as HTMLElement;
  const home = root.querySelector("[data-home]");

  const onHome = () => goto("home");
  home?.addEventListener("click", onHome);

  function lineClass(line: CaptionLine, index: number, total: number): string {
    if (!line.isFinal) return "line interim";
    if (index === total - 1 || (index === total - 2 && !state.lines[total - 1]?.isFinal)) return "line";
    return "line faded";
  }

  function renderWindow(lang: Lang): string {
    const visible = state.lines.filter((line) => line.text[lang]?.trim());
    const body =
      visible.length === 0
        ? `<p class="empty-caption">Waiting for live speech…</p>`
        : visible
            .map(
              (line, index) =>
                `<p class="${lineClass(line, index, visible.length)}">${escapeHtml(line.text[lang])}</p>`,
            )
            .join("");
    return `
      <section class="window" data-lang="${lang}" lang="${lang}">
        <h2 class="window-label">${LANG_SHORT[lang]} · ${LANG_LABEL[lang]}</h2>
        <div class="lines">${body}</div>
      </section>
    `;
  }

  function render() {
    const langs = langsForLayout(state.layout);
    roomEl.textContent = state.room;
    const phoneNote = peers.phones > 0 ? "Phone connected" : "Waiting for phone";
    statusEl.textContent = state.listening ? `Live · ${phoneNote}` : phoneNote;
    dot.className = `dot ${state.listening ? "listening" : connStatus === "live" ? "live" : "offline"}`;
    board.dataset.count = String(langs.length);
    board.dataset.layout = state.layout;
    board.innerHTML = langs.map(renderWindow).join("");
  }

  const conn = connectRoom({
    room,
    role: "tv",
    onState(next) {
      state = next;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
