import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
  LOCKOUT_STEPS_MS,
  MAX_FAILS,
  createLoginLimiter,
  issueToken,
  loginLimiter,
  pinConfig,
  verifyToken,
} from "../server/auth";
import { createCaptionServer } from "../server/index";

const TEST_PIN = "4826";
let server: Server;
let base = "";
const saved = { ...process.env };

async function start() {
  server = createCaptionServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeEach(async () => {
  delete process.env.APP_PIN;
  delete process.env.APP_PASSWORD;
  delete process.env.APP_SECRET;
  loginLimiter.reset();
  await start();
});

afterEach(async () => {
  process.env = { ...saved };
  await new Promise<void>((r) => server.close(() => r()));
});

const api = (path: string, init: RequestInit = {}) => fetch(`http://${base}${path}`, init);
const login = (pin: unknown, deviceId = "device-aaaa1111", ip = "10.0.0.1") =>
  api("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ pin, deviceId }),
  });

function wsResult(query = ""): Promise<"open" | number> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${base}/caption-ws${query}`);
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "join", room: "ABCD", role: "tv" }));
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === "joined") {
        ws.terminate();
        resolve("open");
      }
    });
    ws.on("unexpected-response", (_req, res) => {
      resolve(res.statusCode ?? 0);
      ws.terminate();
    });
    ws.on("error", () => resolve(-1));
  });
}

describe("PIN config", () => {
  it("is off when unset or blank, on with 4 digits, fails closed otherwise", () => {
    expect(pinConfig({}).enabled).toBe(false);
    expect(pinConfig({ APP_PASSWORD: "  " }).enabled).toBe(false);
    expect(pinConfig({ APP_PASSWORD: "1234" })).toEqual({ enabled: true, pin: "1234" });
    expect(pinConfig({ APP_PIN: "9876", APP_PASSWORD: "1234" })).toEqual({ enabled: true, pin: "9876" });
    expect(pinConfig({ APP_PASSWORD: "12345" })).toEqual({ enabled: true, pin: null });
    expect(pinConfig({ APP_PASSWORD: "abcd" })).toEqual({ enabled: true, pin: null });
  });

  it("tokens expire, and changing the PIN signs devices out", () => {
    const env = { APP_PIN: TEST_PIN };
    const now = Date.now();
    const issued = issueToken(env, now)!;
    expect(verifyToken(issued.token, env, now)).toBe(true);
    expect(verifyToken(issued.token, env, issued.expiresAt + 1)).toBe(false);
    expect(verifyToken(issued.token, { APP_PIN: "1111" }, now)).toBe(false);
    expect(verifyToken(`${issued.token}x`, env, now)).toBe(false);
  });
});

describe("gate off (no PIN)", () => {
  it("keeps the API and websocket open", async () => {
    expect((await api("/api/translate")).status).toBe(200);
    expect(await (await api("/api/auth")).json()).toEqual({ required: false, ok: true });
    expect(await wsResult()).toBe("open");
  });
});

describe("gate on", () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = TEST_PIN;
  });

  it("keeps /health and the app shell public", async () => {
    expect((await api("/health")).status).toBe(200);
    expect(await (await api("/api/auth")).json()).toEqual({ required: true, ok: false });
  });

  it("rejects API calls with a missing or wrong token", async () => {
    expect((await api("/api/translate")).status).toBe(401);
    expect((await api("/api/topic-handout", { method: "POST", body: "{}" })).status).toBe(401);
    const bad = await api("/api/translate", { headers: { authorization: "Bearer v1.zzzz.nope" } });
    expect(bad.status).toBe(401);
  });

  it("wrong PIN is 401, right PIN returns a token that works for fetch and cookie", async () => {
    const wrong = await login("0000");
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ error: "wrong_pin", remaining: MAX_FAILS - 1 });

    expect((await login("12")).status).toBe(400);

    const ok = await login(TEST_PIN);
    expect(ok.status).toBe(200);
    const { token } = (await ok.json()) as { token: string };
    expect(token).toMatch(/^v1\./);

    expect((await api("/api/translate", { headers: { authorization: `Bearer ${token}` } })).status).toBe(200);
    expect((await api("/api/translate", { headers: { cookie: `ff_auth=${encodeURIComponent(token)}` } })).status).toBe(200);
    expect(await (await api("/api/auth", { headers: { authorization: `Bearer ${token}` } })).json()).toEqual({
      required: true,
      ok: true,
    });
  });

  it("rejects a websocket join without a token and accepts one with it", async () => {
    expect(await wsResult()).toBe(401);
    expect(await wsResult("?auth=v1.zzzz.bad")).toBe(401);
    const { token } = (await (await login(TEST_PIN)).json()) as { token: string };
    expect(await wsResult(`?auth=${encodeURIComponent(token)}`)).toBe("open");
  });

  it("locks out after 5 wrong PINs with 429 + Retry-After, even for the right PIN", async () => {
    for (let i = 0; i < MAX_FAILS - 1; i++) expect((await login("0000")).status).toBe(401);
    const fifth = await login("0000");
    expect(fifth.status).toBe(429);
    expect(Number(fifth.headers.get("retry-after"))).toBe(60);
    expect(((await fifth.json()) as { retryAfter: number }).retryAfter).toBe(60);
    const blocked = await login(TEST_PIN);
    expect(blocked.status).toBe(429);
  });

  it("locks per IP even when the device id changes", async () => {
    for (let i = 0; i < MAX_FAILS; i++) await login("0000", `device-rotate-${i}0000`, "10.9.9.9");
    expect((await login(TEST_PIN, "device-fresh-00001", "10.9.9.9")).status).toBe(429);
    // A different IP and device is not affected.
    expect((await login(TEST_PIN, "device-other-00001", "10.1.1.1")).status).toBe(200);
  });

  it("locks per device even when the IP changes", async () => {
    for (let i = 0; i < MAX_FAILS; i++) await login("0000", "device-same-0001", `10.2.0.${i}`);
    expect((await login(TEST_PIN, "device-same-0001", "10.3.0.1")).status).toBe(429);
  });

  it("refuses every login when the PIN is not 4 digits", async () => {
    process.env.APP_PASSWORD = "12345";
    expect((await login("1234")).status).toBe(503);
    expect((await api("/api/translate")).status).toBe(401);
  });
});

describe("lockout schedule", () => {
  it("grows 1 min, 5 min, 15 min, then stays at 15 min", () => {
    const lim = createLoginLimiter();
    const keys = ["ip:1.2.3.4"];
    let now = 1_000_000;
    const seen: number[] = [];
    for (let round = 0; round < 4; round++) {
      let last = { lockedFor: 0, remaining: 0 };
      for (let i = 0; i < MAX_FAILS; i++) {
        expect(lim.lockedFor(keys, now)).toBe(0);
        last = lim.fail(keys, now);
        if (i < MAX_FAILS - 1) expect(last).toEqual({ lockedFor: 0, remaining: MAX_FAILS - 1 - i });
      }
      seen.push(last.lockedFor);
      expect(lim.lockedFor(keys, now + 1000)).toBe(last.lockedFor - 1000);
      now += last.lockedFor + 1;
    }
    expect(seen).toEqual([LOCKOUT_STEPS_MS[0], LOCKOUT_STEPS_MS[1], LOCKOUT_STEPS_MS[2], LOCKOUT_STEPS_MS[2]]);
  });

  it("success clears strikes; an hour of quiet resets the step", () => {
    const lim = createLoginLimiter();
    const keys = ["dev:abc12345"];
    for (let i = 0; i < MAX_FAILS - 1; i++) lim.fail(keys, 0);
    lim.success(keys);
    expect(lim.fail(keys, 0)).toEqual({ lockedFor: 0, remaining: MAX_FAILS - 1 });

    const k2 = ["ip:5.5.5.5"];
    for (let i = 0; i < MAX_FAILS; i++) lim.fail(k2, 0);
    const later = LOCKOUT_STEPS_MS[0] + 61 * 60_000;
    let r = { lockedFor: 0, remaining: 0 };
    for (let i = 0; i < MAX_FAILS; i++) r = lim.fail(k2, later);
    expect(r.lockedFor).toBe(LOCKOUT_STEPS_MS[0]);
  });
});
