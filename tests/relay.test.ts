import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { attachCaptionRelay } from "../server/relay";

type Msg = Record<string, any>;

let server: Server;
let url = "";
const sockets: WebSocket[] = [];

beforeEach(async () => {
  server = createServer();
  attachCaptionRelay(server, { heartbeatMs: 60_000 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/caption-ws`;
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate();
  await new Promise<void>((r) => server.close(() => r()));
});

function connect() {
  const ws = new WebSocket(url);
  sockets.push(ws);
  const inbox: Msg[] = [];
  const waiters: Array<() => void> = [];
  ws.on("message", (raw) => {
    inbox.push(JSON.parse(String(raw)));
    waiters.splice(0).forEach((w) => w());
  });
  const next = async (pred: (m: Msg) => boolean, ms = 2000): Promise<Msg> => {
    const end = Date.now() + ms;
    for (;;) {
      const i = inbox.findIndex(pred);
      if (i >= 0) return inbox.splice(i, 1)[0];
      if (Date.now() > end) throw new Error("timeout waiting for message");
      await new Promise<void>((r) => {
        waiters.push(r);
        setTimeout(r, 50);
      });
    }
  };
  const opened = new Promise<void>((r) => ws.on("open", () => r()));
  return { ws, inbox, next, opened, send: (m: Msg) => ws.send(JSON.stringify(m)) };
}

async function join(role: string, clientId?: string, name = "A") {
  const c = connect();
  await c.opened;
  c.send({ type: "join", room: "ABCD", role, name, clientId });
  const joined = await c.next((m) => m.type === "joined");
  return { ...c, peerId: joined.peerId as string, joined };
}

describe("relay reconnect turn handling", () => {
  it("hands the speaking turn to a reconnect of the same tab, before its queued push", async () => {
    const tv = await join("tv");
    const first = await join("guest", "tab-aaaaaaaa", "Luis");
    first.send({ type: "floor", action: "claim", rid: 7 });
    const claim = await first.next((m) => m.type === "floor" && m.rid === 7);
    expect(claim.ok).toBe(true);

    // Same tab reconnects (old socket not closed yet, e.g. Wi-Fi blip).
    const again = await join("guest", "tab-aaaaaaaa", "Luis");
    expect(again.joined.floor.holderId).toBe(again.peerId);
    again.send({ type: "floor", action: "claim", rid: 1 });
    again.send({
      type: "push",
      state: { listening: true, sourceLang: "es", lines: [{ id: "l1", isFinal: true, text: { en: "hi", es: "hola", pt: "olá" }, at: 1 }] },
    });
    const reclaim = await again.next((m) => m.type === "floor" && m.rid === 1);
    expect(reclaim.ok).toBe(true);
    const state = await tv.next((m) => m.type === "state" && m.state.lines?.length === 1);
    expect(state.state.lines[0].text.es).toBe("hola");
    expect(state.state.floor.holderId).toBe(again.peerId);
    await new Promise<void>((r) => (first.ws.readyState === WebSocket.CLOSED ? r() : first.ws.on("close", () => r())));
  });

  it("a different tab cannot take a held turn", async () => {
    const a = await join("guest", "tab-aaaaaaaa");
    a.send({ type: "floor", action: "claim", rid: 1 });
    await a.next((m) => m.rid === 1);
    const b = await join("guest", "tab-bbbbbbbb");
    b.send({ type: "floor", action: "claim", rid: 2 });
    const res = await b.next((m) => m.rid === 2);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("busy");
  });

  it("notifies the pusher when a listening:true push grants a free turn", async () => {
    const tv = await join("tv");
    const host = await join("phone", "tab-hhhhhhhh", "Host");
    host.send({ type: "push", state: { listening: true, lines: [] } });
    const notice = await host.next((m) => m.type === "floor" && m.ok === true && m.action === "claim");
    expect(notice.floor.holderId).toBe(host.peerId);
    const floor = await tv.next((m) => m.type === "floor" && m.floor?.holderId === host.peerId);
    expect(floor).toBeTruthy();
  });
});

describe("relay turn release", () => {
  it("frees the turn when the holder releases", async () => {
    const a = await join("guest", "tab-aaaaaaaa");
    a.send({ type: "floor", action: "claim", rid: 1 });
    await a.next((m) => m.rid === 1);
    a.send({ type: "floor", action: "release", rid: 2 });
    const rel = await a.next((m) => m.rid === 2);
    expect(rel.ok).toBe(true);
    expect(rel.floor.holderId).toBeNull();
  });

  it("frees the turn when the holder's socket drops", async () => {
    const b = await join("guest", "tab-bbbbbbbb");
    const a = await join("guest", "tab-aaaaaaaa");
    a.send({ type: "floor", action: "claim", rid: 1 });
    await a.next((m) => m.rid === 1);
    a.ws.terminate();
    const freed = await b.next((m) => m.type === "floor" && m.floor?.holderId === null && m.ok === undefined);
    expect(freed.floor.holderId).toBeNull();
  });

  it("answers an app-level ping", async () => {
    const a = await join("guest");
    a.send({ type: "ping" });
    expect((await a.next((m) => m.type === "pong")).type).toBe("pong");
  });
});
