import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { requestAuthorized } from "./auth.ts";

type Role = "phone" | "tv" | "guest";

type Floor = {
  holderId: string | null;
  holderName: string | null;
};

type Client = {
  id: string;
  ws: WebSocket;
  room: string;
  role: Role;
  name: string;
  /** Stable per-tab id from the browser, so a reconnect keeps the speaking turn. */
  clientId: string | null;
};

type RoomState = Record<string, unknown>;

type Room = {
  clients: Set<Client>;
  state: RoomState | null;
  floor: Floor;
};

type Inbound =
  | { type: "join"; room: string; role?: string; name?: string; clientId?: string }
  | { type: "push"; state: unknown }
  | { type: "ping" }
  | { type: "floor"; action?: string; name?: string; rid?: number };

/** Heartbeat: ping every interval; terminate a socket after this many missed pongs. */
export const HEARTBEAT_MS = 20_000;
export const MAX_MISSED_PONGS = 2;

const LAYOUTS = new Set(["en", "es", "pt", "en-es", "en-pt", "es-pt", "en-es-pt"]);
const LANGS = new Set(["en", "es", "pt"]);

export type CaptionRelay = {
  roomCount(): number;
};

export function attachCaptionRelay(
  httpServer: Server | null,
  options: { heartbeatMs?: number } = {},
): CaptionRelay {
  if (!httpServer) return { roomCount: () => 0 };

  const flagged = httpServer as Server & { __ffRelay?: CaptionRelay };
  if (flagged.__ffRelay) return flagged.__ffRelay;

  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map<string, Room>();
  const api: CaptionRelay = { roomCount: () => rooms.size };
  flagged.__ffRelay = api;

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = req.url ?? "";
    if (!url.startsWith("/caption-ws")) return;
    if (!requestAuthorized(req)) {
      // PIN gate on and no valid ?auth= token: refuse before the upgrade.
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  const missed = new WeakMap<WebSocket, number>();
  const heartbeat = setInterval(() => {
    for (const sock of wss.clients) {
      const count = missed.get(sock) ?? 0;
      if (count >= MAX_MISSED_PONGS) {
        // A phone that locked or lost Wi-Fi without a FIN. Free its turn now.
        sock.terminate();
        continue;
      }
      missed.set(sock, count + 1);
      try {
        sock.ping();
      } catch {
        sock.terminate();
      }
    }
  }, options.heartbeatMs ?? HEARTBEAT_MS);
  heartbeat.unref?.();
  httpServer.on("close", () => clearInterval(heartbeat));

  wss.on("connection", (ws) => {
    let client: Client | null = null;
    missed.set(ws, 0);
    ws.on("pong", () => missed.set(ws, 0));

    ws.on("message", (raw) => {
      let msg: Inbound;
      try {
        msg = JSON.parse(String(raw)) as Inbound;
      } catch {
        return;
      }
      missed.set(ws, 0);

      if (msg.type === "ping") {
        send(ws, { type: "pong" });
        return;
      }

      if (msg.type === "join" && typeof msg.room === "string") {
        leave();
        const room = msg.room.trim().toUpperCase();
        if (!/^[A-Z2-9]{4}$/.test(room)) {
          send(ws, { type: "error", message: "Invalid room code" });
          return;
        }
        const role = parseRole(msg.role);
        let bucket = rooms.get(room);
        if (!bucket) {
          bucket = { clients: new Set(), state: null, floor: emptyFloor() };
          rooms.set(room, bucket);
        }
        const clientId = parseClientId(msg.clientId);
        client = {
          id: randomUUID(),
          ws,
          room,
          role,
          name: sanitizeName(msg.name, role === "phone" ? "Host" : role === "guest" ? "Guest" : "Brother"),
          clientId,
        };
        // Same tab reconnecting: retire its old socket and hand the turn over.
        if (clientId) {
          for (const old of [...bucket.clients]) {
            if (old.clientId !== clientId || old.ws === ws) continue;
            bucket.clients.delete(old);
            if (bucket.floor.holderId === old.id) {
              bucket.floor = { holderId: client.id, holderName: client.name };
              rememberFloor(bucket);
            }
            try {
              old.ws.terminate();
            } catch {
              /* gone */
            }
          }
        }
        bucket.clients.add(client);
        const counts = peerCounts(bucket);
        send(ws, {
          type: "joined",
          room,
          peerId: client.id,
          role,
          floor: snapshotFloor(bucket.floor),
          ...counts,
        });
        if (bucket.state) {
          send(ws, { type: "state", state: withFloor(bucket.state, bucket.floor, client.room) });
        }
        broadcastPeers(bucket);
        return;
      }

      if (!client) return;
      const bucket = rooms.get(client.room);
      if (!bucket) return;

      if (msg.type === "floor") {
        if (typeof msg.name === "string") client.name = sanitizeName(msg.name, client.name);
        handleFloor(bucket, client, parseFloorAction(msg.action), parseRid(msg.rid));
        return;
      }

      if (msg.type !== "push") return;
      applyPush(bucket, client, msg.state);
    });

    ws.on("close", leave);
    ws.on("error", leave);

    function leave() {
      if (!client) return;
      const bucket = rooms.get(client.room);
      if (bucket) {
        const leaving = client;
        client = null;
        // Already replaced by a reconnect of the same tab.
        if (!bucket.clients.delete(leaving)) return;
        if (bucket.floor.holderId === leaving.id) {
          bucket.floor = emptyFloor();
          if (bucket.state) {
            bucket.state = withFloor(
              { ...bucket.state, listening: false },
              bucket.floor,
              leaving.room,
            );
            broadcastState(bucket);
          }
          broadcastFloor(bucket);
        }
        if (bucket.clients.size === 0) rooms.delete(leaving.room);
        else broadcastPeers(bucket);
      }
      client = null;
    }
  });

  return api;
}

function handleFloor(
  bucket: Room,
  client: Client,
  action: "claim" | "release" | "force" | "",
  rid?: number,
): void {
  const sendFloorResult = (c: Client, ok: boolean, reason: string | undefined, floor: Floor) =>
    sendFloorReply(c, ok, reason, floor, action || undefined, rid);
  if (!action) {
    sendFloorResult(client, false, "denied", bucket.floor);
    return;
  }

  if (action === "release") {
    if (!bucket.floor.holderId || bucket.floor.holderId === client.id) {
      bucket.floor = emptyFloor();
      patchListening(bucket, false);
      rememberFloor(bucket);
      sendFloorResult(client, true, undefined, bucket.floor);
      broadcastFloor(bucket);
      if (bucket.state) broadcastState(bucket, client.ws);
      return;
    }
    sendFloorResult(client, false, "denied", bucket.floor);
    return;
  }

  if (action === "force") {
    if (client.role !== "phone") {
      sendFloorResult(client, false, "denied", bucket.floor);
      return;
    }
    bucket.floor = { holderId: client.id, holderName: client.name };
    patchListening(bucket, false);
    rememberFloor(bucket);
    sendFloorResult(client, true, undefined, bucket.floor);
    broadcastFloor(bucket);
    if (bucket.state) broadcastState(bucket, client.ws);
    return;
  }

  if (action === "claim") {
    if (!bucket.floor.holderId || bucket.floor.holderId === client.id) {
      bucket.floor = { holderId: client.id, holderName: client.name };
      rememberFloor(bucket);
      sendFloorResult(client, true, undefined, bucket.floor);
      broadcastFloor(bucket);
      if (bucket.state) broadcastState(bucket, client.ws);
      return;
    }
    sendFloorResult(client, false, "busy", bucket.floor);
  }
}

function applyPush(bucket: Room, client: Client, raw: unknown): void {
  if (client.role === "tv") return;
  const incoming = asRecord(raw);
  if (!incoming) return;

  const isHost = client.role === "phone";
  const isGuest = client.role === "guest";
  const wantsMic = incoming.listening === true;
  const dropsMic = incoming.listening === false;

  if (wantsMic && bucket.floor.holderId && bucket.floor.holderId !== client.id) {
    if (isHost) {
      // Host reclaim by pushing listening:true is not enough — UI uses force.
      send(client.ws, {
        type: "floor",
        ok: false,
        reason: "busy",
        action: "claim",
        floor: snapshotFloor(bucket.floor),
      });
      applyHostMeta(bucket, client, incoming);
      return;
    }
    send(client.ws, {
      type: "floor",
      ok: false,
      reason: "busy",
      action: "claim",
      floor: snapshotFloor(bucket.floor),
    });
    return;
  }

  let granted = false;
  if (wantsMic && (!bucket.floor.holderId || bucket.floor.holderId === client.id)) {
    granted = bucket.floor.holderId !== client.id;
    bucket.floor = { holderId: client.id, holderName: client.name };
  }

  const holding = bucket.floor.holderId === client.id;
  const hostOwnsIdle = isHost && !bucket.floor.holderId;
  if (isGuest && !holding) {
    if (wantsMic) {
      send(client.ws, {
        type: "error",
        message: "Mic in use",
        floor: snapshotFloor(bucket.floor),
      });
    }
    // listening:false after the floor was already released is not a caption.
    return;
  }

  const base = bucket.state ?? defaultState(client.room);
  const next: RoomState = { ...base, room: client.room };

  if (isHost) {
    if ("topic" in incoming) next.topic = incoming.topic ?? null;
    if (typeof incoming.layout === "string" && LAYOUTS.has(incoming.layout)) {
      next.layout = incoming.layout;
    }
  }

  if (holding || hostOwnsIdle) {
    if (Array.isArray(incoming.lines)) {
      next.lines = stampNewSpeakers(base.lines, incoming.lines, bucket.floor.holderName, client.role);
    }
    if (typeof incoming.sourceLang === "string" && LANGS.has(incoming.sourceLang)) {
      next.sourceLang = incoming.sourceLang;
    }
    if (typeof incoming.listening === "boolean") next.listening = incoming.listening;
    if (dropsMic) bucket.floor = emptyFloor();
  }

  bucket.state = withFloor(next, bucket.floor, client.room);
  const payload = JSON.stringify({ type: "state", state: bucket.state });
  for (const peer of bucket.clients) {
    if (peer.ws !== client.ws && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(payload);
    }
  }
  if (dropsMic) broadcastFloor(bucket);
  if (granted) {
    // A push with listening:true took a free turn. Tell the pusher and everyone else.
    sendFloorReply(client, true, undefined, bucket.floor, "claim");
    broadcastFloor(bucket, client.ws);
  }
}

function applyHostMeta(bucket: Room, client: Client, incoming: RoomState): void {
  if (client.role !== "phone") return;
  const base = bucket.state ?? defaultState(client.room);
  const next: RoomState = { ...base, room: client.room };
  if ("topic" in incoming) next.topic = incoming.topic ?? null;
  if (typeof incoming.layout === "string" && LAYOUTS.has(incoming.layout)) {
    next.layout = incoming.layout;
  }
  bucket.state = withFloor(next, bucket.floor, client.room);
  broadcastState(bucket, client.ws);
}

function patchListening(bucket: Room, listening: boolean): void {
  if (!bucket.state) return;
  bucket.state = withFloor({ ...bucket.state, listening }, bucket.floor, String(bucket.state.room ?? ""));
}

/** State snapshots must carry the live floor. A claim used to broadcast the previous null holder. */
function rememberFloor(bucket: Room): void {
  if (!bucket.state) return;
  const room = typeof bucket.state.room === "string" ? bucket.state.room : "";
  bucket.state = withFloor(bucket.state, bucket.floor, room);
}

function defaultState(room: string): RoomState {
  return {
    room,
    layout: "en-es-pt",
    sourceLang: "en",
    listening: false,
    lines: [],
    topic: null,
    floor: emptyFloor(),
  };
}

function withFloor(state: RoomState, floor: Floor, room: string): RoomState {
  return {
    ...state,
    room: typeof state.room === "string" && state.room ? state.room : room,
    floor: snapshotFloor(floor),
    listening: floor.holderId ? Boolean(state.listening) : false,
  };
}

function emptyFloor(): Floor {
  return { holderId: null, holderName: null };
}

function snapshotFloor(floor: Floor): Floor {
  return { holderId: floor.holderId, holderName: floor.holderName };
}

function parseRole(value: unknown): Role {
  if (value === "tv") return "tv";
  if (value === "guest") return "guest";
  return "phone";
}

function parseFloorAction(value: unknown): "claim" | "release" | "force" | "" {
  if (value === "claim" || value === "release" || value === "force") return value;
  return "";
}

function sanitizeName(value: unknown, fallback: string): string {
  const name = String(value ?? "")
    .replace(/[\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
  return name || fallback;
}

/** Keep a name already stored on a line. New lines pick up the person who has the floor. */
function stampNewSpeakers(previous: unknown, incoming: unknown[], holderName: string | null, role: Role): unknown[] {
  const prevIds = new Set<string>();
  if (Array.isArray(previous)) {
    for (const line of previous) {
      if (line && typeof line === "object" && typeof (line as { id?: unknown }).id === "string") {
        prevIds.add((line as { id: string }).id);
      }
    }
  }
  const fallback = role === "phone" ? "Host" : role === "guest" ? "Guest" : "";
  const active = sanitizeName(holderName, fallback);
  return incoming.map((line) => {
    if (!line || typeof line !== "object") return line;
    const record = { ...(line as Record<string, unknown>) };
    const named = sanitizeName(record.speaker, "");
    const id = typeof record.id === "string" ? record.id : "";
    if (named) record.speaker = named;
    else if ((!id || !prevIds.has(id)) && active) record.speaker = active;
    else delete record.speaker;
    return record;
  });
}

function asRecord(value: unknown): RoomState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RoomState;
}

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function sendFloorReply(
  client: Client,
  ok: boolean,
  reason: string | undefined,
  floor: Floor,
  action?: string,
  rid?: number,
): void {
  send(client.ws, {
    type: "floor",
    ok,
    reason,
    action,
    rid,
    floor: snapshotFloor(floor),
  });
}

function parseClientId(value: unknown): string | null {
  return typeof value === "string" && /^[\w-]{8,64}$/.test(value) ? value : null;
}

function parseRid(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function peerCounts(bucket: Room): { phones: number; tvs: number; guests: number } {
  let phones = 0;
  let tvs = 0;
  let guests = 0;
  for (const client of bucket.clients) {
    if (client.role === "tv") tvs += 1;
    else if (client.role === "guest") {
      guests += 1;
      phones += 1;
    } else phones += 1;
  }
  return { phones, tvs, guests };
}

function broadcastPeers(bucket: Room): void {
  const payload = JSON.stringify({ type: "peers", ...peerCounts(bucket) });
  for (const client of bucket.clients) {
    if (client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
  }
}

function broadcastFloor(bucket: Room, except?: WebSocket): void {
  const payload = JSON.stringify({ type: "floor", floor: snapshotFloor(bucket.floor) });
  for (const client of bucket.clients) {
    if (client.ws === except) continue;
    if (client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
  }
}

function broadcastState(bucket: Room, except?: WebSocket): void {
  if (!bucket.state) return;
  const payload = JSON.stringify({ type: "state", state: bucket.state });
  for (const peer of bucket.clients) {
    if (peer.ws === except) continue;
    if (peer.ws.readyState === WebSocket.OPEN) peer.ws.send(payload);
  }
}
