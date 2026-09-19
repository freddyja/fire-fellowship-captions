import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";

type Role = "phone" | "tv";

type Client = {
  ws: WebSocket;
  room: string;
  role: Role;
};

type Room = {
  clients: Set<Client>;
  state: unknown;
};

type Inbound =
  | { type: "join"; room: string; role?: string }
  | { type: "push"; state: unknown };

export function attachCaptionRelay(httpServer: Server | null): void {
  if (!httpServer) return;

  const flagged = httpServer as Server & { __ffRelay?: boolean };
  if (flagged.__ffRelay) return;
  flagged.__ffRelay = true;

  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map<string, Room>();

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = req.url ?? "";
    if (!url.startsWith("/caption-ws")) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    let client: Client | null = null;

    ws.on("message", (raw) => {
      let msg: Inbound;
      try {
        msg = JSON.parse(String(raw)) as Inbound;
      } catch {
        return;
      }

      if (msg.type === "join" && typeof msg.room === "string") {
        leave();
        const room = msg.room.trim().toUpperCase();
        if (!/^[A-Z2-9]{4}$/.test(room)) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid room code" }));
          return;
        }
        const role: Role = msg.role === "tv" ? "tv" : "phone";
        let bucket = rooms.get(room);
        if (!bucket) {
          bucket = { clients: new Set(), state: null };
          rooms.set(room, bucket);
        }
        client = { ws, room, role };
        bucket.clients.add(client);
        const counts = peerCounts(bucket);
        ws.send(JSON.stringify({ type: "joined", room, ...counts }));
        if (bucket.state) {
          ws.send(JSON.stringify({ type: "state", state: bucket.state }));
        }
        broadcastPeers(bucket);
        return;
      }

      if (!client || msg.type !== "push") return;
      const bucket = rooms.get(client.room);
      if (!bucket) return;
      bucket.state = msg.state;
      const payload = JSON.stringify({ type: "state", state: msg.state });
      for (const peer of bucket.clients) {
        if (peer.ws !== ws && peer.ws.readyState === WebSocket.OPEN) {
          peer.ws.send(payload);
        }
      }
    });

    ws.on("close", leave);
    ws.on("error", leave);

    function leave() {
      if (!client) return;
      const bucket = rooms.get(client.room);
      if (bucket) {
        bucket.clients.delete(client);
        if (bucket.clients.size === 0) rooms.delete(client.room);
        else broadcastPeers(bucket);
      }
      client = null;
    }
  });
}

function peerCounts(bucket: Room): { phones: number; tvs: number } {
  let phones = 0;
  let tvs = 0;
  for (const client of bucket.clients) {
    if (client.role === "phone") phones += 1;
    else tvs += 1;
  }
  return { phones, tvs };
}

function broadcastPeers(bucket: Room): void {
  const payload = JSON.stringify({ type: "peers", ...peerCounts(bucket) });
  for (const client of bucket.clients) {
    if (client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
  }
}
