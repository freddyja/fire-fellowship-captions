import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";

const started = [];
const target = process.argv[2] || "http://127.0.0.1:8080";
const base = target.replace(/\/$/, "");
const wsBase = base.replace(/^http/, "ws");

async function json(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function text(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return { res, body: await res.text() };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function waitForHealth() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const health = await json("/health");
      if (health.ok) return health;
    } catch {
      /* retry */
    }
    await delay(250);
  }
  throw new Error(`No /health from ${base}`);
}

async function connect(role, room) {
  const ws = new WebSocket(`${wsBase}/caption-ws`);
  const inbox = [];
  await new Promise((resolve, reject) => {
    ws.once("error", reject);
    ws.once("open", resolve);
  });
  ws.on("message", (raw) => inbox.push(JSON.parse(String(raw))));
  ws.send(JSON.stringify({ type: "join", room, role }));
  return { ws, inbox };
}

async function waitFor(inbox, type) {
  for (let i = 0; i < 40; i += 1) {
    const hit = inbox.find((msg) => msg.type === type);
    if (hit) return hit;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${type}`);
}

async function maybeStartLocal() {
  if (process.argv[2]) return;
  try {
    await json("/health");
    return;
  } catch {
    /* start local production server */
  }
  const child = spawn(process.execPath, ["--experimental-strip-types", "server/index.ts"], {
    env: { ...process.env, PORT: "8080", HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  started.push(child);
  child.stdout.on("data", (buf) => process.stdout.write(buf));
  child.stderr.on("data", (buf) => process.stderr.write(buf));
}

async function main() {
  await maybeStartLocal();
  const health = await waitForHealth();
  assert(health.ok === true, "health.ok");
  assert(
    health.translate === "deepl" ||
      health.translate === "mymemory" ||
      health.translate === "mock" ||
      health.translate === "google",
    "health.translate",
  );

  const home = await text("/");
  assert(home.body.includes("Fire and Fellowship"), "home shell");
  assert(home.body.includes("manifest.webmanifest"), "manifest link");

  const phone = await text("/?view=phone&room=ABCD");
  const tv = await text("/?view=tv&room=ABCD");
  assert(phone.body.includes('<div id="app">'), "phone route serves shell");
  assert(tv.body.includes('<div id="app">'), "tv route serves shell");

  const scriptSrc = home.body.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert(scriptSrc, "built app script");
  const { body: appJs } = await text(scriptSrc);
  assert(appJs.includes("Send to TV"), "phone Send to TV button");
  assert(appJs.includes("Open TV view"), "optional Open TV view");
  assert(appJs.includes("Copy TV link"), "copy TV link");
  assert(appJs.includes("Keep the Fold on the mic page"), "send-to-TV steps");
  assert(appJs.includes("QR code for the TV caption page"), "TV QR code");
  assert(!appJs.includes("Smart View"), "no Smart View label");
  assert(!appJs.includes("PresentationRequest"), "no Presentation API");
  assert(!/\.requestSession\b/.test(appJs), "no presentation requestSession");
  assert(!appJs.includes("startSmartView"), "no Smart View helper");
  assert(!appJs.includes("android.settings.CAST_SETTINGS"), "no Android Cast intent");
  assert(!appJs.includes("com.samsung.android.smartmirroring"), "no Samsung Smart View intent");

  const { body: manifestText } = await text("/manifest.webmanifest");
  const manifest = JSON.parse(manifestText);
  assert(manifest.name === "Fire and Fellowship", "manifest name");
  assert(manifest.short_name === "Fire and Fellowship", "manifest short_name");
  assert(manifest.display === "standalone", "manifest display");
  assert(manifest.start_url === "/", "manifest start_url");
  assert(manifest.theme_color === "#120c09", "manifest theme");
  assert(
    manifest.icons?.some((icon) => icon.sizes === "192x192" && icon.src.endsWith(".png")),
    "192 icon",
  );
  assert(
    manifest.icons?.some((icon) => icon.sizes === "512x512" && icon.src.endsWith(".png")),
    "512 icon",
  );

  const { body: sw } = await text("/sw.js");
  assert(sw.includes('addEventListener("fetch"'), "service worker fetch handler");
  assert(sw.includes("/caption-ws"), "service worker skips relay");
  assert(sw.includes("/api/translate"), "service worker skips translate API");

  const translateStatus = await json("/api/translate");
  assert(translateStatus.provider === health.translate, "GET /api/translate provider");

  const translateRes = await fetch(`${base}/api/translate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: "Welcome brothers. Thank you for coming tonight. Let us begin.",
      from: "en",
    }),
  });
  assert(translateRes.ok, "POST /api/translate");
  const translated = await translateRes.json();
  assert(translated.text?.en?.includes("Welcome brothers"), "source language passthrough");
  assert(Boolean(translated.text?.es && translated.text?.pt), "es/pt present");
  if (translated.provider === "mock") {
    assert(String(translated.text.es).toLowerCase().includes("bienvenidos"), "mock es");
    assert(String(translated.text.pt).toLowerCase().includes("irm"), "mock pt");
  }
  if (translated.provider === "mymemory") {
    assert(String(translated.text.es).trim() !== translated.text.en, "mymemory es differs from en");
    assert(String(translated.text.pt).trim() !== translated.text.en, "mymemory pt differs from en");
  }
  const leaked =
    JSON.stringify(translated).includes("GOOGLE_TRANSLATE") ||
    JSON.stringify(translated).includes("DEEPL_AUTH") ||
    JSON.stringify(translated).includes("AIza");
  assert(!leaked, "translate response must not include a key");

  for (const icon of ["/icon-192.png", "/icon-512.png", "/icon-192-maskable.png", "/icon-512-maskable.png"]) {
    const res = await fetch(`${base}${icon}`);
    assert(res.ok, icon);
    assert(res.headers.get("content-type")?.includes("png"), `${icon} content-type`);
  }

  const phoneWs = await connect("phone", "ABCD");
  const tvWs = await connect("tv", "ABCD");
  await waitFor(phoneWs.inbox, "joined");
  await waitFor(tvWs.inbox, "joined");

  const topicState = {
    room: "ABCD",
    sourceLang: "en",
    layout: "en-es-pt",
    listening: false,
    lines: [],
    topic: {
      id: "brotherhood",
      title: { en: "Brotherhood", es: "Fraternidad", pt: "Irmandade" },
      reference: "Proverbs 27:17",
      verse: { en: "Iron sharpens iron.", es: "Hierro con hierro se aguza.", pt: "O ferro com o ferro se afia." },
      prompt: { en: "Talk.", es: "Hablen.", pt: "Falemos." },
    },
  };
  phoneWs.ws.send(JSON.stringify({ type: "push", state: topicState }));
  const delivered = await waitFor(tvWs.inbox, "state");
  assert(delivered.state?.topic?.id === "brotherhood", "topic of the day reached TV");
  assert(delivered.state?.topic?.reference === "Proverbs 27:17", "verse reference reached TV");

  phoneWs.ws.close();
  tvWs.ws.close();
  console.log(`OK ${base} — PWA shell, phone/TV routes, Send to TV, relay, topic of the day, translate=${health.translate}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const child of started) child.kill("SIGTERM");
    process.exit(process.exitCode ?? 0);
  });
