import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static all: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  sent: any[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  reply(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

let dispatch: (type: string) => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.all = [];
  const listeners = new Map<string, Set<() => void>>();
  dispatch = (t: string) => listeners.get(t)?.forEach((f) => f());
  const target = {
    addEventListener: (t: string, f: () => void) => (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(f),
    removeEventListener: (t: string, f: () => void) => listeners.get(t)?.delete(f),
  };
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("location", { protocol: "https:", host: "x.test" });
  vi.stubGlobal("window", { ...target, setTimeout, clearTimeout });
  vi.stubGlobal("document", { ...target, visibilityState: "visible" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function load() {
  return import("../src/realtime/client");
}

function conn(connectRoom: any) {
  return connectRoom({
    room: "ABCD",
    role: "guest",
    name: "Luis",
    clientId: "tab-aaaaaaaa",
    onState() {},
    onPeers() {},
    onStatus() {},
  });
}

describe("client reconnect turn handling", () => {
  it("re-claims the turn before flushing queued captions after a reconnect", async () => {
    const { connectRoom } = await load();
    const c = conn(connectRoom);
    const s1 = FakeSocket.all[0];
    s1.open();
    const claim = c.claimFloor();
    const req = s1.sent.find((m) => m.type === "floor");
    s1.reply({ type: "floor", ok: true, action: "claim", rid: req.rid, floor: { holderId: "p1", holderName: "Luis" } });
    expect(await claim).toBe(true);

    s1.close(); // Wi-Fi blip
    c.push({ room: "ABCD", lines: [], listening: true } as any); // queued while offline
    await vi.advanceTimersByTimeAsync(10_000);
    const s2 = FakeSocket.all[1];
    s2.open();
    expect(s2.sent.map((m) => m.type)).toEqual(["join", "floor", "push"]);
    expect(s2.sent[0].clientId).toBe("tab-aaaaaaaa");
    expect(s2.sent[1].action).toBe("claim");
    c.close();
  });

  it("does not re-claim after the turn was released", async () => {
    const { connectRoom } = await load();
    const c = conn(connectRoom);
    const s1 = FakeSocket.all[0];
    s1.open();
    const claim = c.claimFloor();
    s1.reply({ type: "floor", ok: true, action: "claim", rid: s1.sent.at(-1).rid });
    await claim;
    const rel = c.releaseFloor();
    s1.reply({ type: "floor", ok: true, action: "release", rid: s1.sent.at(-1).rid });
    await rel;
    s1.close();
    await vi.advanceTimersByTimeAsync(10_000);
    const s2 = FakeSocket.all[1];
    s2.open();
    expect(s2.sent.map((m) => m.type)).toEqual(["join"]);
    c.close();
  });

  it("answers a floor request at once with reason 'offline' while disconnected", async () => {
    const { connectRoom } = await load();
    const c = conn(connectRoom);
    expect(await c.claimFloor()).toBe(false);
    expect(c.lastFloorReason()).toBe("offline");
    c.close();
  });

  it("matches floor replies by request id, not arrival order", async () => {
    const { connectRoom } = await load();
    const c = conn(connectRoom);
    const s1 = FakeSocket.all[0];
    s1.open();
    const a = c.claimFloor();
    const b = c.releaseFloor();
    const [ra, rb] = s1.sent.filter((m) => m.type === "floor").map((m) => m.rid);
    s1.reply({ type: "floor", ok: true, rid: rb });
    s1.reply({ type: "floor", ok: false, reason: "busy", rid: ra });
    expect(await a).toBe(false);
    expect(await b).toBe(true);
    c.close();
  });

  it("reconnects when a wake-up probe gets no answer", async () => {
    const { connectRoom } = await load();
    const c = conn(connectRoom);
    const s1 = FakeSocket.all[0];
    s1.open();
    dispatch("online");
    expect(s1.sent.at(-1).type).toBe("ping");
    await vi.advanceTimersByTimeAsync(3100);
    expect(FakeSocket.all.length).toBe(2);
    c.close();
  });

  it("keeps the socket when the probe is answered", async () => {
    const { connectRoom } = await load();
    const c = conn(connectRoom);
    const s1 = FakeSocket.all[0];
    s1.open();
    dispatch("visibilitychange");
    s1.reply({ type: "pong" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(FakeSocket.all.length).toBe(1);
    c.close();
  });
});
