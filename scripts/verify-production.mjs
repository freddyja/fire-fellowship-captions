import { spawn } from "node:child_process";
import { accessSync, constants, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

async function connect(role, room, name) {
  const ws = new WebSocket(`${wsBase}/caption-ws`);
  const inbox = [];
  await new Promise((resolve, reject) => {
    ws.once("error", reject);
    ws.once("open", resolve);
  });
  ws.on("message", (raw) => inbox.push(JSON.parse(String(raw))));
  ws.send(JSON.stringify({ type: "join", room, role, name }));
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

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const bin of candidates) {
    try {
      accessSync(bin, constants.X_OK);
      return bin;
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error("Chrome is required to check that Join Watch=ES does not change the TV");
}

function cdpSocket(ws) {
  let next = 0;
  const pending = new Map();
  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    if (!msg.id || !pending.has(msg.id)) return;
    const slot = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) slot.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
    else slot.resolve(msg.result ?? {});
  });
  return {
    send(method, params = {}, sessionId) {
      const id = ++next;
      const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, 10000);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        ws.send(JSON.stringify(payload));
      });
    },
  };
}

const JOIN_SNAPSHOT = `(() => {
  const setup = document.querySelector("[data-join-setup]");
  const board = document.querySelector("[data-board]");
  const topic = document.querySelector("[data-topic]");
  const screen = document.querySelector("[data-join-screen], .tv-screen");
  const tv = document.querySelector(".tv-screen");
  const setupVisible = Boolean(setup && !setup.hidden);
  const roomVisible = Boolean(screen && !screen.hidden);
  if (!tv && !setup && !screen) return null;
  if (!tv && setupVisible) {
    return {
      setupVisible: true,
      roomVisible: false,
      setupSpoken: document.querySelector("[data-setup-lang].active")?.dataset.setupLang || "",
      setupWatch: document.querySelector("[data-setup-watch].active")?.dataset.setupWatch || "",
      spoken: "",
      langs: [],
      count: "",
      layout: "",
      text: "",
      watch: "",
      roomLayout: "",
      stored: sessionStorage.getItem("ff-join-watch"),
      storedSpoken: sessionStorage.getItem("ff-join-spoken"),
      topicHidden: true,
      topicCount: "",
      topicText: "",
      langLock: false,
      mark: window.__ffWatchMark || "",
      continueLabel: document.querySelector("[data-join-continue]")?.textContent?.trim() || "",
    };
  }
  if (!board || !screen) return null;
  return {
    setupVisible,
    roomVisible: tv ? true : roomVisible,
    setupSpoken: document.querySelector("[data-setup-lang].active")?.dataset.setupLang || "",
    setupWatch: document.querySelector("[data-setup-watch].active")?.dataset.setupWatch || "",
    spoken: document.querySelector("[data-source] [data-lang].active")?.dataset.lang || "",
    langs: [...board.querySelectorAll(".window")].map((node) => node.getAttribute("data-lang")),
    count: board.dataset.count || "",
    layout: board.dataset.layout || "",
    text: board.textContent || "",
    watch: screen.dataset.watch || "",
    roomLayout: screen.dataset.roomLayout || "",
    stored: sessionStorage.getItem("ff-join-watch"),
    storedSpoken: sessionStorage.getItem("ff-join-spoken"),
    topicHidden: Boolean(topic?.hidden),
    topicCount: topic?.dataset.count || "",
    topicText: topic?.textContent || "",
    langLock: Boolean(document.querySelector(".is-lang-lock")),
    mark: window.__ffWatchMark || "",
    continueLabel: "",
  };
})()`;

async function openChrome() {
  const bin = findChrome();
  const port = 20000 + Math.floor(Math.random() * 20000);
  const userData = mkdtempSync(join(tmpdir(), "ff-join-watch-"));
  const child = spawn(
    bin,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--ignore-certificate-errors",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userData}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  started.push(child);
  let stderr = "";
  child.stderr.on("data", (buf) => {
    stderr = `${stderr}${buf}`.slice(-2000);
  });
  let version = null;
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        version = await res.json();
        break;
      }
    } catch {
      /* chrome is still starting */
    }
    await delay(150);
  }
  if (!version?.webSocketDebuggerUrl) {
    child.kill("SIGTERM");
    throw new Error(`Chrome did not open a DevTools port. ${stderr}`);
  }
  const browserWs = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    browserWs.once("open", resolve);
    browserWs.once("error", reject);
  });
  const cdp = cdpSocket(browserWs);

  async function evaluate(sessionId, expression) {
    const result = await cdp.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
      throw new Error(text || "page evaluate failed");
    }
    return result.result?.value;
  }

  async function open(url, { width, height, mobile }) {
    const created = await cdp.send("Target.createTarget", { url: "about:blank" });
    const attached = await cdp.send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
    const sessionId = attached.sessionId;
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width, height, deviceScaleFactor: 1, mobile },
      sessionId,
    );
    await cdp.send("Page.navigate", { url }, sessionId);
    return sessionId;
  }

  async function waitForSnapshot(sessionId, match) {
    let last = null;
    for (let i = 0; i < 50; i += 1) {
      try {
        last = await evaluate(sessionId, JOIN_SNAPSHOT);
        if (last && match(last)) return last;
      } catch (error) {
        last = { error: String(error) };
      }
      await delay(200);
    }
    throw new Error(`Timed out waiting for Join/TV panes: ${JSON.stringify(last)}`);
  }

  return {
    open,
    evaluate,
    waitForSnapshot,
    send: cdp.send.bind(cdp),
    close() {
      try {
        browserWs.close();
      } catch {
        /* already closed */
      }
      child.kill("SIGTERM");
      try {
        rmSync(userData, { recursive: true, force: true });
      } catch {
        /* profile may still be releasing */
      }
    },
  };
}

async function assertJoinWatchIsDeviceLocal() {
  const room = "WACH";
  const host = await connect("phone", room, "Host");
  const tvRelay = await connect("tv", room);
  await waitFor(host.inbox, "joined");
  await waitFor(tvRelay.inbox, "joined");
  host.ws.send(
    JSON.stringify({
      type: "push",
      state: {
        room,
        sourceLang: "es",
        layout: "en-es-pt",
        listening: false,
        lines: [
          {
            id: "watch-line",
            isFinal: true,
            at: Date.now(),
            text: {
              en: "Welcome brothers.",
              es: "Bienvenidos hermanos.",
              pt: "Bem-vindos irmãos.",
            },
          },
        ],
        topic: {
          id: "brotherhood",
          title: { en: "Brotherhood", es: "Fraternidad", pt: "Irmandade" },
          reference: "Proverbs 27:17",
          verse: { en: "Iron sharpens iron.", es: "Hierro con hierro se aguza.", pt: "O ferro com o ferro se afia." },
          hook: { en: "A dull man is usually a lonely man.", es: "Un hombre sin filo.", pt: "Um homem sem fio." },
          body: { en: "Iron does not sharpen iron from across the room.", es: "El hierro no aguza desde lejos.", pt: "O ferro não afia de longe." },
          discussionQuestions: [{ en: "Who is sharpening you?", es: "¿Quién te está aguzando?", pt: "Quem está te afiando?" }],
          prompt: { en: "Talk.", es: "Hablen.", pt: "Falemos." },
        },
      },
    }),
  );
  await waitFor(tvRelay.inbox, "state", (msg) => msg.state?.lines?.[0]?.id === "watch-line");

  const chrome = await openChrome();
  const waitForEval = async (sessionId, expression, match) => {
    let last = null;
    for (let i = 0; i < 50; i += 1) {
      try {
        last = await chrome.evaluate(sessionId, expression);
        if (match(last)) return last;
      } catch (error) {
        last = { error: String(error) };
      }
      await delay(200);
    }
    throw new Error(`Timed out waiting for page: ${JSON.stringify(last)}`);
  };
  try {
    const hostPage = await chrome.open(`${base}/`, { width: 390, height: 844, mobile: true });
    await waitForEval(hostPage, `Boolean(document.querySelector("[data-create]"))`, (ready) => ready === true);
    await chrome.evaluate(hostPage, `document.querySelector("[data-create]").click()`);
    const hostMetrics = await waitForEval(
      hostPage,
      `(() => {
        const screen = document.querySelector(".phone-screen");
        if (!screen) return null;
        const style = getComputedStyle(screen);
        const joinBtn = document.querySelector("[data-join-phones]");
        const spoken = document.querySelector("[data-source]");
        const layout = document.querySelector("[data-layouts]");
        const smart = document.querySelector("[data-smart-view-mode]");
        const send = document.querySelector("[data-send-tv]");
        if (!joinBtn || !spoken || !layout || !smart || !send) return null;
        const box = (node) => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top, height: rect.height, width: rect.width };
        };
        return {
          overflow: style.overflow,
          maxHeight: style.maxHeight,
          screenHeight: screen.getBoundingClientRect().height,
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
          join: box(joinBtn),
          spoken: box(spoken),
          layout: box(layout),
          smart: box(smart),
          send: box(send),
        };
      })()`,
      (metrics) => metrics && metrics.overflow,
    );
    assert(hostMetrics.overflow === "visible", "host Create room does not lock overflow");
    assert(hostMetrics.maxHeight === "none", "host Create room is not pinned to a max height");
    assert(hostMetrics.scrollHeight > hostMetrics.innerHeight, "host Create room is taller than the phone viewport");
    for (const name of ["spoken", "layout", "smart", "send", "join"]) {
      assert(hostMetrics[name].height >= 44 && hostMetrics[name].width >= 44, `host ${name} control is tappable`);
    }
    await chrome.evaluate(hostPage, `document.querySelector("[data-join-phones]").scrollIntoView({ block: "center" })`);
    const joinHit = await chrome.evaluate(
      hostPage,
      `(() => {
        const btn = document.querySelector("[data-join-phones]");
        const rect = btn.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return Boolean(hit && (hit === btn || btn.contains(hit)));
      })()`,
    );
    assert(joinHit, "Join on phones is the element under the tap");
    await saveWatchShot(chrome, hostPage, "host-create-room.png", false);

    const join = await chrome.open(`${base}/?view=join&room=${room}`, { width: 390, height: 844, mobile: true });
    const tv = await chrome.open(`${base}/?view=tv&room=${room}`, { width: 1280, height: 800, mobile: false });
    const setup = await chrome.waitForSnapshot(join, (snap) => snap.setupVisible && !snap.roomVisible);
    assert(setup.continueLabel === "Join", "Join onboarding has one Join button");
    assert(setup.setupSpoken === "en", "Join asks spoken language before the caption board");
    assert(setup.setupWatch === "all", "Join Watch defaults to all three before entering");
    assert(
      setup.text === "" && setup.langs.length === 0,
      "caption board stays hidden until Join",
    );
    await saveWatchShot(chrome, join, "join-setup.png", false);
    await chrome.evaluate(
      join,
      `document.querySelector('[data-setup-lang="es"]').click();
       document.querySelector('[data-setup-watch="pt"]').click();
       const name = document.querySelector("[data-setup-name]");
       name.value = "Ana";
       name.dispatchEvent(new Event("change", { bubbles: true }));
       document.querySelector("[data-join-continue]").click();`,
    );
    const joinPt = await chrome.waitForSnapshot(
      join,
      (snap) =>
        snap.roomVisible &&
        !snap.setupVisible &&
        snap.watch === "pt" &&
        snap.spoken === "es" &&
        snap.langs.length === 1 &&
        snap.text.includes("Bem-vindos irmãos."),
    );
    assert(joinPt.count === "1" && joinPt.langs[0] === "pt", "Watch chosen before Join paints only that pane");
    assert(joinPt.roomLayout === "en-es-pt", "pre-room Watch does not change the room layout");
    assert(!joinPt.topicHidden && joinPt.topicCount === "3", "Join keeps the fellowship topic sheet");
    assert(
      joinPt.topicText.includes("ES · Español") && joinPt.topicText.includes("PT · Português"),
      "Join topic sheet stays EN | ES | PT",
    );
    assert(joinPt.topicText.includes("Hierro con hierro"), "Join topic still includes the Spanish verse");
    assert(joinPt.stored === "pt" && joinPt.storedSpoken === "es", "Spoken and Watch are saved for this phone");
    const dockHit = await chrome.evaluate(
      join,
      `(() => {
        const spoken = document.querySelector('[data-source] [data-lang="es"]');
        const watch = document.querySelector('[data-watch="pt"]');
        const screen = document.querySelector("[data-join-screen]");
        const style = getComputedStyle(screen);
        spoken.scrollIntoView({ block: "center" });
        const spokenRect = spoken.getBoundingClientRect();
        const spokenHit = document.elementFromPoint(spokenRect.left + spokenRect.width / 2, spokenRect.top + Math.min(spokenRect.height / 2, 20));
        watch.scrollIntoView({ block: "center" });
        const watchRect = watch.getBoundingClientRect();
        const watchHit = document.elementFromPoint(watchRect.left + watchRect.width / 2, watchRect.top + Math.min(watchRect.height / 2, 20));
        return {
          overflow: style.overflow,
          maxHeight: style.maxHeight,
          spoken: Boolean(spokenHit && (spokenHit === spoken || spoken.contains(spokenHit))),
          watch: Boolean(watchHit && (watchHit === watch || watch.contains(watchHit))),
          spokenH: spokenRect.height,
          watchH: watchRect.height,
        };
      })()`,
    );
    assert(dockHit.overflow === "visible" && dockHit.maxHeight === "none", "Join room scrolls instead of locking the viewport");
    assert(dockHit.spoken && dockHit.spokenH >= 44, "Spoken stays tappable on the join room");
    assert(dockHit.watch && dockHit.watchH >= 44, "Watch stays tappable on the join room");
    await saveWatchShot(chrome, join, "join-watch-pt.png", true);

    await chrome.evaluate(join, `document.querySelector('[data-watch="all"]').click()`);
    const joinAll = await chrome.waitForSnapshot(
      join,
      (snap) => snap.roomVisible && snap.watch === "all" && snap.langs.length === 3 && snap.text.includes("Bienvenidos hermanos."),
    );
    assert(joinAll.roomLayout === "en-es-pt", "Join keeps the room layout while Watch is all");
    assert(joinAll.langs.join(",") === "en,es,pt", "Watch=all shows EN, ES, and PT on the join client");
    assert(joinAll.count === "3", "Watch=all paints three caption panes");
    assert(joinAll.spoken === "es", "switching Watch does not change Spoken");
    assert(!joinAll.topicHidden && joinAll.topicCount === "3", "Watch=all keeps the fellowship topic sheet");
    await saveWatchShot(chrome, join, "join-watch-all.png", true);

    const tvAll = await chrome.waitForSnapshot(
      tv,
      (snap) => snap.langs.length === 3 && snap.text.includes("Bienvenidos hermanos."),
    );
    assert(tvAll.layout === "en-es-pt" && tvAll.langs.join(",") === "en,es,pt", "TV shows EN | ES | PT for the room");
    assert(!tvAll.langLock, "combined TV is not a one-language monitor");
    assert(tvAll.text.includes("Welcome brothers.") && tvAll.text.includes("Bem-vindos irmãos."), "TV has the full caption");

    await chrome.evaluate(join, `document.querySelector('[data-watch="es"]').click()`);
    const joinEs = await chrome.waitForSnapshot(
      join,
      (snap) => snap.watch === "es" && snap.langs.length === 1 && snap.langs[0] === "es",
    );
    assert(joinEs.count === "1", "Watch=ES shows only the ES pane on the join client");
    assert(joinEs.layout === "es", "Watch=ES caption board is the Spanish pane");
    assert(!joinEs.text.includes("Welcome brothers."), "Watch=ES does not show the English caption");
    assert(joinEs.text.includes("Bienvenidos hermanos."), "Watch=ES shows the Spanish caption");
    assert(!joinEs.langs.includes("en") && !joinEs.langs.includes("pt"), "Watch=ES hides EN and PT panes");
    assert(joinEs.roomLayout === "en-es-pt", "Watch=ES does not change the room layout");
    assert(!joinEs.topicHidden && joinEs.topicCount === "3", "Watch=ES keeps the EN | ES | PT topic sheet");
    assert(
      joinEs.topicText.includes("ES · Español") && joinEs.topicText.includes("PT · Português") && joinEs.topicText.includes("Hierro con hierro"),
      "Watch=ES does not strip the Spanish or Portuguese topic columns",
    );
    assert(joinEs.stored === "es", "Watch=ES is saved for the guest session");
    await saveWatchShot(chrome, join, "join-watch-es.png", true);

    await delay(400);
    const tvAfter = await chrome.evaluate(tv, JOIN_SNAPSHOT);
    assert(tvAfter.langs.join(",") === "en,es,pt", "TV still has three panes after the guest sets Watch=ES");
    assert(tvAfter.layout === "en-es-pt", "TV layout stayed EN | ES | PT");
    assert(
      tvAfter.text.includes("Welcome brothers.") && tvAfter.text.includes("Bienvenidos hermanos.") && tvAfter.text.includes("Bem-vindos irmãos."),
      "TV still shows the same EN | ES | PT caption",
    );
    await saveWatchShot(chrome, tv, "tv-still-three-panes.png", false);
    assert(
      tvRelay.inbox.every((msg) => msg.type !== "state" || msg.state?.layout === "en-es-pt"),
      "guest Watch did not push a layout change to the room",
    );

    await chrome.evaluate(join, `window.__ffWatchMark = "before"`);
    await chrome.send("Page.reload", { ignoreCache: true }, join);
    const setupAgain = await chrome.waitForSnapshot(
      join,
      (snap) => snap.mark !== "before" && snap.setupVisible && !snap.roomVisible && snap.setupWatch === "es" && snap.setupSpoken === "es",
    );
    assert(setupAgain.stored === "es", "Watch=ES is still stored after reload, before Join");
    await chrome.evaluate(join, `document.querySelector("[data-join-continue]").click()`);
    const joinKept = await chrome.waitForSnapshot(
      join,
      (snap) => snap.roomVisible && snap.watch === "es" && snap.langs.length === 1 && snap.text.includes("Bienvenidos hermanos."),
    );
    assert(joinKept.langs[0] === "es" && joinKept.stored === "es" && joinKept.spoken === "es", "Watch=ES survives a reload of the join page");
    assert(joinKept.roomLayout === "en-es-pt", "reloaded Join still does not own the room layout");

    const tvStill = await chrome.waitForSnapshot(
      tv,
      (snap) => snap.langs.length === 3 && snap.layout === "en-es-pt" && snap.text.includes("Welcome brothers."),
    );
    assert(tvStill.langs.join(",") === "en,es,pt", "TV still has three panes for the same room caption");
  } finally {
    chrome.close();
    host.ws.close();
    tvRelay.ws.close();
  }
}

async function saveWatchShot(chrome, sessionId, name, scrollBoard) {
  const dir = "/opt/cursor/artifacts/screenshots";
  try {
    if (scrollBoard) {
      await chrome.evaluate(
        sessionId,
        `document.querySelector("[data-board]")?.scrollIntoView({ block: "start", inline: "nearest" })`,
      );
    }
    await delay(150);
    let image = null;
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        image = await chrome.send("Page.captureScreenshot", { format: "png" }, sessionId);
        break;
      } catch (error) {
        lastError = error;
        await delay(300);
      }
    }
    if (!image?.data) throw lastError || new Error("screenshot failed");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), Buffer.from(image.data, "base64"));
  } catch (error) {
    console.error(`screenshot ${name} failed: ${error}`);
  }
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
      health.translate === "mint" ||
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
  const tvLang = await text("/?view=tv&room=ABCD&lang=es");
  const join = await text("/?view=join&room=ABCD");
  assert(phone.body.includes('<div id="app">'), "phone route serves shell");
  assert(tv.body.includes('<div id="app">'), "tv route serves shell");
  assert(tvLang.body.includes('<div id="app">'), "tv lang=es route serves shell");
  assert(join.body.includes('<div id="app">'), "join route serves shell");

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
  assert(appJs.includes("O caminho mais seguro"), "integrity hook pt");
  assert(appJs.includes("The safest walk is the one that does not need a cover story"), "integrity hook en");
  assert(appJs.includes("Coragem não é a ausência de medo"), "courage hook pt");
  assert(appJs.includes("Send to TV"), "phone Send to TV button");
  assert(appJs.includes("Open TV view"), "optional Open TV view");
  assert(appJs.includes("Copy TV link"), "copy TV link");
  assert(appJs.includes("Keep the Fold on the mic page"), "send-to-TV steps");
  assert(appJs.includes("One language per monitor"), "per-language TV helpers");
  assert(appJs.includes("data-copy-lang"), "copy per-language TV link");
  assert(appJs.includes("data-open-lang"), "open per-language TV window");
  assert(appJs.includes("does not change other TVs in this room"), "lang= does not drive other TVs");
  assert(appJs.includes("is-lang-lock"), "TV lang lock class");
  assert(appJs.includes("QR code for the TV caption page"), "TV QR code");
  assert(appJs.includes("Smart View mode"), "Smart View mode button");
  assert(appJs.includes("Exit Smart View mode"), "exit Smart View mode");
  assert(appJs.includes("Captions only"), "Smart View captions-only toggle");
  assert(appJs.includes("data-smart-source"), "Smart View spoken language chips");
  assert(appJs.includes("Spoken language:"), "Smart View spoken language aria labels");
  assert(appJs.includes("Join on phones"), "host Join on phones button");
  assert(appJs.includes("Brothers scan to watch"), "join QR reminder");
  assert(appJs.includes("Someone else is speaking"), "floor busy copy");
  assert(appJs.includes("Reclaim mic"), "host can reclaim the mic");
  assert(appJs.includes("view=join"), "brothers join query");
  assert(appJs.includes("Spoken language"), "spoken language chips");
  assert(appJs.includes("data-join-setup"), "join questions come before the caption board");
  assert(appJs.includes("What language are you speaking?"), "join asks spoken language first");
  assert(appJs.includes("What language do you want to watch?"), "join asks watch language first");
  assert(appJs.includes("data-join-continue"), "join setup has one continue button");
  assert(appJs.includes("EN only") && appJs.includes("ES only") && appJs.includes("PT only"), "join Watch language chips");
  assert(appJs.includes("All three"), "join Watch defaults to all three panes");
  assert(appJs.includes("This phone only"), "Watch is labeled as this phone only");
  assert(appJs.includes("ff-join-watch"), "Watch preference is stored for the guest session");
  assert(appJs.includes('data-watch="es"'), "Watch=ES chip");
  assert(appJs.includes("Type a caption"), "type-to-send caption fallback");
  assert(appJs.includes("Chrome on Android"), "Android Chrome is best for live speech");
  assert(appJs.includes("iPhone"), "iPhone join is documented in the UI");
  assert(
    appJs.includes("Type a caption — Send still reaches every phone and the TV."),
    "iPhone mic failure tells you to type",
  );
  assert(appJs.includes("Safari rejected"), "rejected speech locale is named");
  assert(appJs.includes("phone-live-board"), "host phone shows EN ES PT caption panes");
  assert(appJs.includes("join-screen"), "guest join is a phone layout, not Fold-only");
  assert(appJs.includes("Offline / Local meeting"), "offline / local meeting toggle");
  assert(appJs.includes("Offline translate (limited phrases)"), "offline translate banner");
  assert(appJs.includes("npm run build"), "laptop setup npm run build");
  assert(appJs.includes("http://LAPTOP-LAN-IP:PORT"), "laptop LAN URL");
  assert(appJs.includes("Design by Freddy Jara-Almonte"), "design credit footer");
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
  assert(appCss.includes("smart-view-source-chip"), "Smart View spoken language chip style");
  assert(appCss.includes("join-screen"), "guest join screen class");
  assert(appCss.includes("join-setup"), "join setup screen is styled");
  assert(appCss.includes("join-watch-note"), "Watch note style");
  assert(
    !/phone-screen:not\(\.is-smart-view\)\{[^}]*overflow:\s*hidden/.test(appCss.replace(/\s+/g, "")),
    "host phone screen does not lock the viewport",
  );
  assert(
    !/\.join-screen\{[^}]*overflow:\s*hidden/.test(appCss.replace(/\s+/g, "")),
    "join caption screen does not lock the viewport",
  );
  assert(!appCss.includes("join-dock-pin"), "join dock is not a pinned layer");
  assert(!appCss.includes("--join-vvh"), "join is not locked to a visual-viewport variable");
  assert(!/position:\s*fixed/.test(appCss), "join does not use a fixed lock overlay");
  assert(appCss.includes("phone-live-board"), "host caption panes are styled");
  assert(appCss.includes("100svh"), "iOS small viewport height");
  assert(appCss.includes("safe-area-inset-top") && appCss.includes("safe-area-inset-bottom"), "safe area insets");
  assert(appCss.includes("repeat(3,minmax(0,1fr))") || appCss.includes("repeat(3, minmax(0, 1fr))"), "triple pane columns");
  assert(appCss.includes("is-lang-lock") && appCss.includes(".line.faded"), "lang-lock shows latest caption");
  assert(!appCss.includes("min(28vh, 10rem)"), "Smart View topic not clipped to 10rem");
  assert(!appCss.includes("min(30vh, 7.5rem)"), "Smart View topic not clipped to 7.5rem");

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
  if (translated.provider === "mymemory" || translated.provider === "mint") {
    assert(String(translated.text.es).trim() !== translated.text.en, `${translated.provider} es differs from en`);
    assert(String(translated.text.pt).trim() !== translated.text.en, `${translated.provider} pt differs from en`);
  }

  for (const sample of [
    {
      from: "es",
      text: "El pastor nos invita a orar juntos esta noche.",
      expect: { en: /invite|pray|tonight|together/i, pt: /convid|orar|noite|juntos/i },
    },
    {
      from: "pt",
      text: "O pastor nos convida a orar juntos esta noite.",
      expect: { en: /invite|pray|tonight|together/i, es: /invit|orar|noche|juntos/i },
    },
    {
      from: "en",
      text: "The pastor invites us to pray together tonight.",
      expect: { es: /pastor|invit|orar|noche/i, pt: /pastor|convid|orar|noite/i },
    },
  ]) {
    const res = await fetch(`${base}/api/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: sample.text, from: sample.from }),
    });
    assert(res.ok, `POST /api/translate free-form ${sample.from}`);
    const body = await res.json();
    assert(
      body.provider === "mymemory" || body.provider === "mint" || body.provider === "deepl" || body.provider === "google",
      `free-form ${sample.from} provider ${body.provider} should be live MT, not mock`,
    );
    assert(String(body.text[sample.from] || "").includes(sample.text.slice(0, 8)), `${sample.from} pane keeps source`);
    for (const [to, pattern] of Object.entries(sample.expect)) {
      const value = String(body.text[to] || "");
      assert(value.trim() !== sample.text, `free-form ${sample.from}->${to} identity`);
      assert(pattern.test(value), `free-form ${sample.from}->${to}: ${value}`);
    }
  }

  const healthAfter = await json("/health");
  const translateStatusAfter = await json("/api/translate");
  assert(
    healthAfter.translate === translateStatusAfter.provider,
    "health and GET /api/translate stay aligned after live captions",
  );
  assert(
    healthAfter.translate === "deepl" ||
      healthAfter.translate === "mymemory" ||
      healthAfter.translate === "mint" ||
      healthAfter.translate === "google" ||
      healthAfter.translate === "mock",
    "health reports a known live provider after translate",
  );

  for (const sample of [
    { from: "es", text: "Bienvenidos hermanos", expectEn: /welcome|brother/i, other: "pt", otherPat: /irm/i },
    { from: "pt", text: "Bem-vindos irmãos", expectEn: /welcome|brother/i, other: "es", otherPat: /bienvenid|herman/i },
  ]) {
    const res = await fetch(`${base}/api/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: sample.text, from: sample.from }),
    });
    assert(res.ok, `POST /api/translate ${sample.from}`);
    const body = await res.json();
    assert(sample.expectEn.test(String(body.text.en)), `${sample.from}→en: ${body.text.en}`);
    assert(sample.otherPat.test(String(body.text[sample.other])), `${sample.from}→${sample.other}: ${body.text[sample.other]}`);
    assert(String(body.text[sample.from]).toLowerCase().includes(sample.text.slice(0, 6).toLowerCase()), `${sample.from} pane keeps source`);
  }

  const mockRes = await fetch(`${base}/api/translate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: "Welcome brothers. Thank you for coming tonight. Let us begin.",
      from: "en",
      provider: "mock",
    }),
  });
  assert(mockRes.ok, "POST /api/translate provider=mock");
  const mocked = await mockRes.json();
  assert(mocked.provider === "mock", "client can force mock without env");
  assert(String(mocked.text.es).toLowerCase().includes("bienvenidos"), "forced mock es");
  assert(String(mocked.text.pt).toLowerCase().includes("irm"), "forced mock pt");

  const anyDirection = [
    {
      from: "es",
      text: "Bienvenidos hermanos. Gracias por venir esta noche.",
      expect: { en: /welcome|thank|coming/i, pt: /irm|obrigado|noite/i },
    },
    {
      from: "pt",
      text: "Bem-vindos irmãos. Obrigado por vir esta noite.",
      expect: { en: /welcome|thank|coming/i, es: /bienvenid|gracias|noche/i },
    },
  ];
  for (const sample of anyDirection) {
    const res = await fetch(`${base}/api/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: sample.text, from: sample.from, provider: "mock" }),
    });
    assert(res.ok, `POST /api/translate mock ${sample.from}`);
    const body = await res.json();
    assert(body.from === sample.from, `mock ${sample.from} from echo`);
    assert(String(body.text[sample.from]).includes(sample.text.slice(0, 10)), `mock ${sample.from} pane keeps source`);
    for (const [to, pattern] of Object.entries(sample.expect)) {
      const value = String(body.text[to] || "");
      assert(value.trim() && value.trim() !== sample.text, `mock ${sample.from}->${to} translated`);
      assert(pattern.test(value), `mock ${sample.from}->${to} unexpected: ${value}`);
    }
  }

  const wrongHint = await fetch(`${base}/api/translate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: "Bienvenidos hermanos. Gracias por venir esta noche.",
      from: "en",
      provider: "mock",
    }),
  });
  assert(wrongHint.ok, "POST /api/translate Spanish with from=en");
  const rescued = await wrongHint.json();
  assert(/welcome|thank/i.test(String(rescued.text.en)), `EN pane English when source is Spanish: ${rescued.text.en}`);
  assert(/bienvenid|gracias/i.test(String(rescued.text.es)), "ES pane stays Spanish when detect overrides from=en");
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

  const captionRoom = "LNGK";
  const captionPhone = await connect("phone", captionRoom);
  const tvCombined = await connect("tv", captionRoom);
  const tvEs = await connect("tv", captionRoom);
  const tvPt = await connect("tv", captionRoom);
  await waitFor(captionPhone.inbox, "joined");
  await waitFor(tvCombined.inbox, "joined");
  await waitFor(tvEs.inbox, "joined");
  await waitFor(tvPt.inbox, "joined");
  const captionState = {
    room: captionRoom,
    sourceLang: "en",
    layout: "en-es-pt",
    listening: true,
    topic: null,
    lines: [
      {
        id: "line-1",
        isFinal: true,
        at: Date.now(),
        text: {
          en: "Welcome brothers.",
          es: "Bienvenidos hermanos.",
          pt: "Bem-vindos irmãos.",
        },
      },
    ],
  };
  captionPhone.ws.send(JSON.stringify({ type: "push", state: captionState }));
  const matchCaption = (msg) => msg.state?.lines?.[0]?.text?.es === "Bienvenidos hermanos.";
  const toCombined = await waitFor(tvCombined.inbox, "state", matchCaption);
  const toEs = await waitFor(tvEs.inbox, "state", matchCaption);
  const toPt = await waitFor(tvPt.inbox, "state", matchCaption);
  assert(toCombined.state?.layout === "en-es-pt", "combined TV still gets room layout");
  assert(toEs.state?.layout === "en-es-pt", "lang window still receives full room layout");
  assert(toEs.state?.lines?.[0]?.text?.en === "Welcome brothers.", "ES window still receives EN text");
  assert(String(toEs.state?.lines?.[0]?.text?.pt || "").includes("irm"), "ES window still receives PT text");
  assert(toPt.state?.lines?.[0]?.text?.es === "Bienvenidos hermanos.", "PT window still receives ES text");
  assert(toCombined.state?.lines?.[0]?.text?.pt === toPt.state?.lines?.[0]?.text?.pt, "all TVs get the same caption stream");

  const floorRoom = "FLRA";
  const hostWs = await connect("phone", floorRoom);
  const guestA = await connect("guest", floorRoom, "Carlos");
  const guestB = await connect("guest", floorRoom, "Luis");
  const floorTv = await connect("tv", floorRoom);
  const hostJoined = await waitFor(hostWs.inbox, "joined");
  const guestAJoined = await waitFor(guestA.inbox, "joined");
  await waitFor(guestB.inbox, "joined");
  await waitFor(floorTv.inbox, "joined");
  assert(Boolean(hostJoined.peerId), "host receives peerId");
  assert(guestAJoined.role === "guest", "guest join role");

  hostWs.ws.send(
    JSON.stringify({
      type: "push",
      state: {
        room: floorRoom,
        sourceLang: "en",
        layout: "en-es-pt",
        listening: false,
        lines: [],
        topic: { id: "brotherhood", title: { en: "Brotherhood", es: "Fraternidad", pt: "Irmandade" } },
      },
    }),
  );
  await waitFor(guestA.inbox, "state", (msg) => msg.state?.topic?.id === "brotherhood");

  guestA.ws.send(JSON.stringify({ type: "floor", action: "claim", name: "Carlos" }));
  const guestAFloor = await waitFor(guestA.inbox, "floor", (msg) => msg.ok === true);
  assert(guestAFloor.floor?.holderName === "Carlos", "guest A holds the floor");
  const claimSnap = await waitFor(
    hostWs.inbox,
    "state",
    (msg) => msg.state?.floor?.holderId === guestAJoined.peerId,
  );
  assert(claimSnap.state?.floor?.holderName === "Carlos", "join claim snapshot names the guest on the host, not a stale empty floor");

  guestB.ws.send(JSON.stringify({ type: "floor", action: "claim", name: "Luis" }));
  const guestBBusy = await waitFor(guestB.inbox, "floor", (msg) => msg.ok === false);
  assert(guestBBusy.reason === "busy", "second guest cannot take the mic");
  assert(guestBBusy.floor?.holderName === "Carlos", "busy result still names the speaker");

  guestB.ws.send(
    JSON.stringify({
      type: "push",
      state: {
        room: floorRoom,
        sourceLang: "es",
        listening: true,
        topic: null,
        layout: "en",
        lines: [
          {
            id: "guest-b-should-not-land",
            isFinal: true,
            at: Date.now(),
            text: { en: "Nope", es: "Nope", pt: "Nope" },
          },
        ],
      },
    }),
  );
  await delay(200);
  assert(
    !hostWs.inbox.some((msg) => msg.state?.lines?.[0]?.id === "guest-b-should-not-land"),
    "guest without the floor cannot push captions",
  );

  guestA.ws.send(
    JSON.stringify({
      type: "push",
      state: {
        room: floorRoom,
        sourceLang: "es",
        listening: true,
        topic: null,
        layout: "pt",
        lines: [
          {
            id: "guest-a-line",
            isFinal: true,
            at: Date.now(),
            text: { en: "Peace to you brothers.", es: "Paz a ustedes hermanos.", pt: "Paz a vocês irmãos." },
          },
        ],
      },
    }),
  );
  const guestCaption = await waitFor(hostWs.inbox, "state", (msg) => msg.state?.lines?.[0]?.id === "guest-a-line");
  const tvCaption = await waitFor(floorTv.inbox, "state", (msg) => msg.state?.lines?.[0]?.id === "guest-a-line");
  const otherGuestCaption = await waitFor(guestB.inbox, "state", (msg) => msg.state?.lines?.[0]?.id === "guest-a-line");
  assert(guestCaption.state?.topic?.id === "brotherhood", "guest speaker cannot wipe host topic");
  assert(guestCaption.state?.layout === "en-es-pt", "guest speaker cannot wipe host layout");
  assert(guestCaption.state?.sourceLang === "es", "speaker sourceLang is the guest spoken language");
  assert(tvCaption.state?.lines?.[0]?.text?.es === "Paz a ustedes hermanos.", "TV shows guest captions");
  assert(otherGuestCaption.state?.lines?.[0]?.text?.en === "Peace to you brothers.", "other guest sees captions");
  assert(guestCaption.state?.floor?.holderName === "Carlos", "floor holder name rides on state");

  hostWs.ws.send(JSON.stringify({ type: "floor", action: "force" }));
  const hostForce = await waitFor(hostWs.inbox, "floor", (msg) => msg.ok === true && msg.floor?.holderId === hostJoined.peerId);
  assert(hostForce.floor?.holderName === "Host", "host reclaim takes the floor");
  await waitFor(guestA.inbox, "floor", (msg) => msg.floor && msg.floor.holderId === hostJoined.peerId);

  guestB.ws.send(JSON.stringify({ type: "floor", action: "claim", name: "Luis" }));
  const guestBStillBusy = await waitFor(
    guestB.inbox,
    "floor",
    (msg) => msg.ok === false && msg.reason === "busy" && msg.floor?.holderId === hostJoined.peerId,
  );
  assert(guestBStillBusy.reason === "busy", "guest cannot start while host holds the floor");

  hostWs.ws.send(JSON.stringify({ type: "floor", action: "release" }));
  await waitFor(guestB.inbox, "floor", (msg) => msg.floor && msg.floor.holderId === null);
  guestB.ws.send(JSON.stringify({ type: "floor", action: "claim", name: "Luis" }));
  const guestBClaim = await waitFor(guestB.inbox, "floor", (msg) => msg.ok === true);
  assert(guestBClaim.floor?.holderName === "Luis", "floor is free after host release");

  const guestSpoken = [];
  async function guestPublishes(id, sourceLang, text) {
    guestSpoken.push({ id, isFinal: true, at: Date.now(), text });
    guestB.ws.send(
      JSON.stringify({
        type: "push",
        state: {
          room: floorRoom,
          sourceLang,
          listening: true,
          lines: guestSpoken,
        },
      }),
    );
    const hostMsg = await waitFor(hostWs.inbox, "state", (msg) => msg.state?.lines?.some((line) => line.id === id));
    assert(hostMsg.state?.sourceLang === sourceLang, `host receives guest ${sourceLang} after releasing the floor`);
    const tvMsg = await waitFor(floorTv.inbox, "state", (msg) => msg.state?.lines?.some((line) => line.id === id));
    assert(tvMsg.state?.sourceLang === sourceLang, `TV receives guest ${sourceLang} after the host released`);
    return hostMsg;
  }
  await guestPublishes("guest-en-after-host", "en", {
    en: "Welcome brothers.",
    es: "Bienvenidos hermanos.",
    pt: "Bem-vindos irmãos.",
  });
  const hostSeesGuestEs = await guestPublishes("guest-es-after-host", "es", {
    en: "Peace to you brothers.",
    es: "Paz a ustedes hermanos.",
    pt: "Paz a vocês irmãos.",
  });
  assert(
    hostSeesGuestEs.state?.lines?.find((line) => line.id === "guest-es-after-host")?.text?.es === "Paz a ustedes hermanos.",
    "join-role caption is on the host",
  );
  const hostSeesGuestPt = await guestPublishes("guest-pt-after-host", "pt", {
    en: "Good night brothers.",
    es: "Buenas noches hermanos.",
    pt: "Boa noite irmãos.",
  });
  assert(
    ["guest-en-after-host", "guest-es-after-host", "guest-pt-after-host"].every((id) =>
      hostSeesGuestPt.state?.lines?.some((line) => line.id === id),
    ),
    "host keeps the guest EN → ES → PT captions",
  );

  const dropRoom = "FLRB";
  const stayHost = await connect("phone", dropRoom);
  const dropGuest = await connect("guest", dropRoom, "Marco");
  await waitFor(stayHost.inbox, "joined");
  await waitFor(dropGuest.inbox, "joined");
  dropGuest.ws.send(JSON.stringify({ type: "floor", action: "claim", name: "Marco" }));
  await waitFor(stayHost.inbox, "floor", (msg) => msg.floor?.holderName === "Marco");
  dropGuest.ws.close();
  await waitFor(stayHost.inbox, "floor", (msg) => msg.floor && msg.floor.holderId === null);

  phoneWs.ws.close();
  tvWs.ws.close();
  captionPhone.ws.close();
  tvCombined.ws.close();
  tvEs.ws.close();
  tvPt.ws.close();
  hostWs.ws.close();
  guestA.ws.close();
  guestB.ws.close();
  floorTv.ws.close();
  stayHost.ws.close();
  await assertJoinWatchIsDeviceLocal();
  console.log(`OK ${base} — PWA shell, phone/TV/join routes, Send to TV + Smart View mode, brothers join + floor control, Join Watch is device-local, relay, topic of the day, ask-for-topic, translate=${health.translate}, topic=${health.topic}`);
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
