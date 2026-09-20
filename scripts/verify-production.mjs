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

async function waitFor(inbox, type, match) {
  for (let i = 0; i < 40; i += 1) {
    const hit = inbox.find((msg) => msg.type === type && (!match || match(msg)));
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
  assert(health.topic === "openai" || health.topic === "offline", "health.topic");

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
  assert(appJs.includes("Ask for topic"), "phone Ask for topic button");
  assert(appJs.includes("Discussion Questions:"), "topic discussion heading");
  assert(appJs.includes("Paul didn't wake up content"), "contentment hook in seeds");
  assert(appJs.includes(" · EN | ES | PT"), "trilingual topic sheet kicker");
  assert(appJs.includes("Cabeza del hogar no es un trono"), "head of household hook es");
  assert(appJs.includes("Cabeça do lar não é um trono"), "head of household hook pt");
  assert(appJs.includes("El caminar más seguro"), "integrity hook es");
  assert(appJs.includes("Coragem não é a ausência de medo"), "courage hook pt");
  assert(appJs.includes("Send to TV"), "phone Send to TV button");
  assert(appJs.includes("Open TV view"), "optional Open TV view");
  assert(appJs.includes("Copy TV link"), "copy TV link");
  assert(appJs.includes("Keep the Fold on the mic page"), "send-to-TV steps");
  assert(appJs.includes("QR code for the TV caption page"), "TV QR code");
  assert(appJs.includes("Smart View mode"), "Smart View mode button");
  assert(appJs.includes("Exit Smart View mode"), "exit Smart View mode");
  assert(appJs.includes("Captions only"), "Smart View captions-only toggle");
  assert(
    appJs.includes("Now open system Smart View → My TV. TV will mirror these captions."),
    "Smart View mode tip",
  );
  assert(!appJs.includes("PresentationRequest"), "no Presentation API");
  assert(!/\.requestSession\b/.test(appJs), "no presentation requestSession");
  assert(!appJs.includes("startSmartView"), "no Smart View launch helper");
  assert(!appJs.includes("android.settings.CAST_SETTINGS"), "no Android Cast intent");
  assert(!appJs.includes("com.samsung.android.smartmirroring"), "no Samsung Smart View intent");
  assert(appJs.includes('dataset.orientation'), "Smart View orientation flag");

  const cssSrc = home.body.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];
  assert(cssSrc, "built app css");
  const { body: appCss } = await text(cssSrc);
  assert(
    appCss.includes("[data-orientation=\"landscape\"]") ||
      appCss.includes('[data-orientation=landscape]'),
    "Smart View landscape keeps language panes",
  );
  assert(appCss.includes("repeat(3,minmax(0,1fr))") || appCss.includes("repeat(3, minmax(0, 1fr))"), "triple pane columns");

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
  assert(sw.includes("/api/topic-handout"), "service worker skips topic handout API");

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

  const topicStatus = await json("/api/topic-handout");
  assert(topicStatus.provider === health.topic, "GET /api/topic-handout provider");

  const seedHandoutRes = await fetch(`${base}/api/topic-handout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "contentment" }),
  });
  assert(seedHandoutRes.ok, "POST /api/topic-handout contentment");
  const seedHandout = await seedHandoutRes.json();
  assert(seedHandout.provider === "seed", "contentment uses seed");
  assert(seedHandout.topic?.id === "contentment", "contentment seed id");
  assert(String(seedHandout.topic?.reference).includes("Philippians 4:11"), "contentment reference");

  const askedRes = await fetch(`${base}/api/topic-handout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "head of household" }),
  });
  assert(askedRes.ok, "POST /api/topic-handout household");
  const asked = await askedRes.json();
  assert(asked.provider === "seed", "head of household uses seed");
  assert(asked.topic?.id === "head-of-household", "head of household seed id");
  assert(String(asked.topic?.reference).includes("Ephesians 5:23"), "headship reference");
  assert(String(asked.topic?.verse?.en || "").includes("husband is the head of the wife"), "headship KJV");
  assert(String(asked.topic?.verse?.es || "").includes("marido es cabeza"), "headship verse es");
  assert(String(asked.topic?.verse?.pt || "").includes("marido é a cabeça"), "headship verse pt");
  assert(Boolean(asked.topic?.hook?.en), "headship hook");
  assert(String(asked.topic?.hook?.es || "").includes("toalla"), "headship hook es");
  assert(String(asked.topic?.hook?.pt || "").includes("toalha"), "headship hook pt");
  assert(Boolean(asked.topic?.body?.es && asked.topic?.body?.pt), "headship teaching es/pt");
  assert((asked.topic?.discussionQuestions || []).length >= 2, "headship questions");
  assert(Boolean(asked.topic?.discussionQuestions?.[0]?.es), "headship questions es");
  assert(Boolean(asked.topic?.discussionQuestions?.[0]?.pt), "headship questions pt");

  const generatedRes = await fetch(`${base}/api/topic-handout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "anxiety and peace" }),
  });
  assert(generatedRes.ok, "POST /api/topic-handout anxiety");
  const generated = await generatedRes.json();
  assert(generated.provider === "offline" || generated.provider === "openai", "generated provider");
  assert(String(generated.topic?.id || "").startsWith("asked-"), "generated id");
  assert(Boolean(generated.topic?.reference), "generated reference");
  assert(String(generated.topic?.verse?.en || "").length > 30, "generated verse present");
  assert(String(generated.topic?.verse?.es || "").length > 20, "generated verse es from catalog");
  assert(String(generated.topic?.verse?.pt || "").length > 20, "generated verse pt from catalog");
  assert(generated.topic?.verse?.es !== generated.topic?.verse?.en, "catalog verse es is not invented English");
  assert(Boolean(generated.topic?.hook?.en), "generated hook");
  assert(Boolean(generated.topic?.hook?.es && generated.topic?.hook?.pt), "generated hook es/pt");
  assert(Boolean(generated.topic?.body?.en), "generated body");
  assert(Boolean(generated.topic?.body?.es && generated.topic?.body?.pt), "generated body es/pt");
  assert((generated.topic?.discussionQuestions || []).length >= 2, "generated questions");
  assert(Boolean(generated.topic?.discussionQuestions?.[0]?.es), "generated questions es");
  const askedLeak = JSON.stringify(generated).includes("OPENAI_API_KEY") || JSON.stringify(generated).includes("sk-");
  assert(!askedLeak, "topic handout must not include a key");

  for (const icon of ["/icon-192.png", "/icon-512.png", "/icon-192-maskable.png", "/icon-512-maskable.png"]) {
    const res = await fetch(`${base}${icon}`);
    assert(res.ok, icon);
    assert(res.headers.get("content-type")?.includes("png"), `${icon} content-type`);
  }

  const phoneWs = await connect("phone", "GN7K");
  const tvWs = await connect("tv", "GN7K");
  await waitFor(phoneWs.inbox, "joined");
  await waitFor(tvWs.inbox, "joined");

  const topicState = {
    room: "GN7K",
    sourceLang: "en",
    layout: "en-es-pt",
    listening: false,
    lines: [],
    topic: {
      id: "brotherhood",
      title: { en: "Brotherhood", es: "Fraternidad", pt: "Irmandade" },
      reference: "Proverbs 27:17",
      verse: { en: "Iron sharpens iron.", es: "Hierro con hierro se aguza.", pt: "O ferro com o ferro se afia." },
      hook: { en: "A dull man is usually a lonely man.", es: "", pt: "" },
      body: { en: "Iron does not sharpen iron from across the room.", es: "", pt: "" },
      discussionQuestions: [{ en: "Who is sharpening you?", es: "", pt: "" }],
      prompt: { en: "Talk.", es: "Hablen.", pt: "Falemos." },
    },
  };
  phoneWs.ws.send(JSON.stringify({ type: "push", state: topicState }));
  const delivered = await waitFor(
    tvWs.inbox,
    "state",
    (msg) => msg.state?.topic?.id === "brotherhood",
  );
  assert(delivered.state?.topic?.id === "brotherhood", "topic of the day reached TV");
  assert(delivered.state?.topic?.reference === "Proverbs 27:17", "verse reference reached TV");

  phoneWs.ws.close();
  tvWs.ws.close();
  console.log(`OK ${base} — PWA shell, phone/TV routes, Send to TV + Smart View mode, relay, topic of the day, ask-for-topic, translate=${health.translate}, topic=${health.topic}`);
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
