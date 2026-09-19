import type { ConnStatus, PeerCounts, Role, RoomState } from "../types";

export type RoomConnection = {
  push(state: RoomState): void;
  close(): void;
};

export function connectRoom(opts: {
  room: string;
  role: Role;
  onState: (state: RoomState) => void;
  onPeers: (peers: PeerCounts) => void;
  onStatus: (status: ConnStatus) => void;
}): RoomConnection {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let retryTimer = 0;

  let queued: RoomState | null = null;

  const flush = () => {
    if (queued && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "push", state: queued }));
    }
  };

  const open = () => {
    if (closed) return;
    opts.onStatus("connecting");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/caption-ws`);

    ws.onopen = () => {
      attempt = 0;
      ws?.send(JSON.stringify({ type: "join", room: opts.room, role: opts.role }));
      opts.onStatus("live");
      flush();
    };

    ws.onmessage = (event) => {
      let msg: { type: string; state?: RoomState; phones?: number; tvs?: number };
      try {
        msg = JSON.parse(String(event.data)) as typeof msg;
      } catch {
        return;
      }
      if (msg.type === "state" && msg.state) opts.onState(msg.state);
      if (msg.type === "peers" || msg.type === "joined") {
        opts.onPeers({ phones: msg.phones ?? 0, tvs: msg.tvs ?? 0 });
      }
    };

    ws.onclose = () => {
      opts.onStatus("offline");
      scheduleRetry();
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  const scheduleRetry = () => {
    if (closed) return;
    attempt += 1;
    const ms = Math.min(8000, 300 * 2 ** attempt);
    retryTimer = window.setTimeout(open, ms);
  };

  open();

  return {
    push(state) {
      queued = state;
      flush();
    },
    close() {
      closed = true;
      window.clearTimeout(retryTimer);
      ws?.close();
      ws = null;
    },
  };
}
