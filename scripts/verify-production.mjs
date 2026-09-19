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
  const child = spawn("npm", ["start"], {
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

  const home = await text("/");
  assert(home.body.includes("Fire Fellowship"), "home shell");
  assert(home.body.includes("manifest.webmanifest"), "manifest link");

  const phone = await text("/?view=phone&room=ABCD");
  const tv = await text("/?view=tv&room=ABCD");
  assert(phone.body.includes('<div id="app">'), "phone route serves shell");
  assert(tv.body.includes('<div id="app">'), "tv route serves shell");

  const { body: manifestText } = await text("/manifest.webmanifest");
  const manifest = JSON.parse(manifestText);
  assert(manifest.name === "Fire Fellowship", "manifest name");
  assert(manifest.short_name === "Fire Fellowship", "manifest short_name");
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
  console.log(`OK ${base} — PWA shell, phone/TV routes, relay, topic of the day`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const child of started) child.kill();
  });
