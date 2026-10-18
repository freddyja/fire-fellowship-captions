import { checkAuth, signalAuthRequired, wsAuthQuery } from "../auth";
import {
  emptyFloor,
  type ConnStatus,
  type FloorState,
  type PeerCounts,
  type Role,
  type RoomState,
} from "../types";

export type FloorNotice = {
  ok?: boolean;
  reason?: string;
  action?: string;
};

/** Shown instead of "someone else is speaking" when the socket is down. */
export const RECONNECTING = "Reconnecting…";

export type FloorResult = { ok: boolean; reason?: string };

/** What a phone sends. listening is left out by a typed caption (no mic change). */
export type RoomPush = Omit<RoomState, "listening"> & { listening?: boolean };

export type RoomConnection = {
  push(state: RoomPush): void;
  claimFloor(name?: string): Promise<boolean>;
  releaseFloor(): Promise<boolean>;
  forceRelease(): Promise<boolean>;
  /** Reason of the last floor reply: "offline" means the socket was down, so the UI should say Reconnecting… */
  lastFloorReason(): string | undefined;
  close(): void;
};

type FloorWire = {
  type: string;
  ok?: boolean;
  reason?: string;
  action?: string;
  rid?: number;
  floor?: FloorState;
};

/** How long a socket may go without any message before a wake/online check treats it as stale. */
const PROBE_TIMEOUT_MS = 3000;

/** A stable id per tab, so a reconnect is recognized as the same speaker. */
export function stableClientId(role: Role, storage: Pick<Storage, "getItem" | "setItem"> | null = safeSession()): string {
  const key = `ff-client-id:${role}`;
  try {
    const existing = storage?.getItem(key);
    if (existing && /^[\w-]{8,64}$/.test(existing)) return existing;
    const made = randomId();
    storage?.setItem(key, made);
    return made;
  } catch {
    return randomId();
  }
}

function safeSession(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function randomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `c${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function connectRoom(opts: {
  room: string;
  role: Role;
  name?: string;
  clientId?: string;
  onState: (state: RoomState) => void;
  onPeers: (peers: PeerCounts) => void;
  onStatus: (status: ConnStatus) => void;
  onJoined?: (info: { peerId: string; floor: FloorState }) => void;
  onFloor?: (floor: FloorState, notice?: FloorNotice) => void;
}): RoomConnection {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let retryTimer = 0;
  let probeTimer = 0;
  const clientId = opts.clientId ?? stableClientId(opts.role);

  let queued: RoomPush | null = null;
  let floor: FloorState = emptyFloor();
  /** True while this tab holds (or should hold) the speaking turn. Re-claimed on every reconnect. */
  let wantFloor = false;
  let speakerName = opts.name;
  let nextRid = 1;
  let lastReason: string | undefined;
  const waiters = new Map<number, (msg: FloorWire) => void>();

  const isOpen = () => ws?.readyState === WebSocket.OPEN;

  const flush = () => {
    if (queued && isOpen()) {
      ws!.send(JSON.stringify({ type: "push", state: queued }));
    }
  };

  const sendFloor = (action: "claim" | "release" | "force", name?: string): Promise<FloorResult> => {
    return new Promise((resolve) => {
      const finish = (result: FloorResult) => {
        lastReason = result.ok ? undefined : result.reason;
        if (action === "release") wantFloor = false;
        else if (result.ok) wantFloor = true;
        resolve(result);
      };
      if (closed) {
        finish({ ok: false, reason: "closed" });
        return;
      }
      if (name) speakerName = name;
      if (!isOpen()) {
        // Never wait 2.5 s on a dead socket. A release still clears the turn locally;
        // the server frees it when this socket closes or a heartbeat terminates it.
        finish({ ok: action === "release", reason: "offline" });
        return;
      }
      const rid = nextRid++;
      const timer = window.setTimeout(() => {
        waiters.delete(rid);
        finish({ ok: false, reason: "timeout" });
      }, 2500);
      waiters.set(rid, (msg) => {
        window.clearTimeout(timer);
        finish({ ok: msg.ok === true, reason: msg.reason });
      });
      ws!.send(JSON.stringify({ type: "floor", action, rid, name: name ?? opts.name }));
    });
  };

  const open = () => {
    if (closed) return;
    window.clearTimeout(retryTimer);
    opts.onStatus("connecting");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${proto}//${location.host}/caption-ws${wsAuthQuery()}`);
    ws = socket;
    let opened = false;

    socket.onopen = () => {
      if (ws !== socket) return;
      opened = true;
      attempt = 0;
      socket.send(
        JSON.stringify({
          type: "join",
          room: opts.room,
          role: opts.role,
          name: speakerName ?? opts.name,
          clientId,
        }),
      );
      // Re-claim the turn BEFORE flushing queued captions. The server handles
      // messages in order, so the push below lands as the floor holder.
      if (wantFloor) {
        const rid = nextRid++;
        waiters.set(rid, (msg) => {
          if (msg.ok !== true) wantFloor = false;
        });
        socket.send(JSON.stringify({ type: "floor", action: "claim", rid, name: speakerName ?? opts.name }));
      }
      opts.onStatus("live");
      flush();
    };

    socket.onmessage = (event) => {
      if (ws !== socket) return;
      window.clearTimeout(probeTimer);
      let msg: {
        type: string;
        state?: RoomState;
        phones?: number;
        tvs?: number;
        guests?: number;
        peerId?: string;
        floor?: FloorState;
        ok?: boolean;
        reason?: string;
        action?: string;
        rid?: number;
      };
      try {
        msg = JSON.parse(String(event.data)) as typeof msg;
      } catch {
        return;
      }
      if (msg.type === "pong") return;
      if (msg.type === "state" && msg.state) {
        if (msg.state.floor) floor = msg.state.floor;
        opts.onState(msg.state);
      }
      if (msg.type === "peers" || msg.type === "joined") {
        opts.onPeers({
          phones: msg.phones ?? 0,
          tvs: msg.tvs ?? 0,
          guests: msg.guests ?? 0,
        });
      }
      if (msg.type === "joined") {
        if (msg.floor) floor = msg.floor;
        if (msg.peerId) opts.onJoined?.({ peerId: msg.peerId, floor: msg.floor ?? floor });
      }
      if (msg.type === "floor") {
        if (msg.floor) floor = msg.floor;
        if (msg.ok === true && msg.action === "claim" && typeof msg.rid !== "number") wantFloor = true;
        const notice: FloorNotice = { ok: msg.ok, reason: msg.reason, action: msg.action };
        // Settle the waiter first so wantFloor is current when the UI hears about it.
        if (typeof msg.rid === "number") {
          const waiter = waiters.get(msg.rid);
          waiters.delete(msg.rid);
          waiter?.(msg);
        }
        opts.onFloor?.(floor, notice);
      }
    };

    socket.onclose = () => {
      if (ws !== socket) return;
      ws = null;
      opts.onStatus("offline");
      // Never opened: maybe the PIN gate refused us (browsers hide the 401).
      if (!opened && attempt >= 1) {
        void checkAuth().then((status) => {
          if (status?.required && !status.ok) signalAuthRequired();
        });
      }
      scheduleRetry();
    };

    socket.onerror = () => {
      socket.close();
    };
  };

  const scheduleRetry = () => {
    if (closed) return;
    attempt += 1;
    const ms = Math.min(8000, 300 * 2 ** attempt);
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(open, ms);
  };

  /** Drop a half-dead socket and dial again right now. */
  const reconnectNow = () => {
    if (closed) return;
    const stale = ws;
    ws = null;
    if (stale) {
      stale.onopen = stale.onmessage = stale.onclose = stale.onerror = null;
      try {
        stale.close();
      } catch {
        /* already closed */
      }
    }
    attempt = 0;
    opts.onStatus("offline");
    open();
  };

  /** After a screen lock or Wi-Fi blip the socket can look open but be dead. Probe it. */
  const checkAlive = () => {
    if (closed) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      reconnectNow();
      return;
    }
    if (!isOpen()) return;
    try {
      ws.send(JSON.stringify({ type: "ping" }));
    } catch {
      reconnectNow();
      return;
    }
    window.clearTimeout(probeTimer);
    probeTimer = window.setTimeout(reconnectNow, PROBE_TIMEOUT_MS);
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") checkAlive();
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", checkAlive);

  open();

  return {
    push(state) {
      queued = state;
      flush();
    },
    async claimFloor(name?: string) {
      return (await sendFloor("claim", name)).ok;
    },
    async releaseFloor() {
      return (await sendFloor("release")).ok;
    },
    async forceRelease() {
      return (await sendFloor("force")).ok;
    },
    lastFloorReason() {
      return lastReason;
    },
    close() {
      closed = true;
      wantFloor = false;
      window.clearTimeout(retryTimer);
      window.clearTimeout(probeTimer);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", checkAlive);
      for (const waiter of waiters.values()) waiter({ type: "floor", ok: false, reason: "closed" });
      waiters.clear();
      ws?.close();
      ws = null;
    },
  };
}
