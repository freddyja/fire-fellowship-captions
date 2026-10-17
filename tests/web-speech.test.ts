import { describe, expect, it } from "vitest";
import { APPLE_COMMIT_MS, createWebSpeechProvider, SILENCE_RESTART_CAP_MS } from "../src/stt/web-speech";

class FakeRec {
  static made: FakeRec[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  started = 0;
  stopped = 0;
  onstart: any = null;
  onaudiostart: any = null;
  onresult: any = null;
  onerror: any = null;
  onend: any = null;
  constructor() {
    FakeRec.made.push(this);
  }
  start() {
    this.started += 1;
  }
  stop() {
    this.stopped += 1;
  }
  abort() {}
  result(text: string, isFinal: boolean) {
    const chunk = Object.assign([{ transcript: text }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [chunk] });
  }
}

function setup(apple: boolean) {
  FakeRec.made = [];
  const restarts: Array<{ run: () => void; delay: number }> = [];
  const commits: Array<() => void> = [];
  const finals: string[] = [];
  const errors: string[] = [];
  const p = createWebSpeechProvider({
    appleMobile: apple,
    recognitionCtor: FakeRec as any,
    scheduleRestart: (run, delay) => restarts.push({ run, delay }),
    scheduleCommit: (run) => commits.push(run),
    scheduleWatchdog: () => {},
  });
  p.onResult = (r) => {
    if (r.isFinal) finals.push(r.text);
  };
  p.onError = (m) => errors.push(m);
  return { p, restarts, commits, finals, errors, rec: () => FakeRec.made.at(-1)! };
}

describe("speech restart behavior", () => {
  it("uses a 1200 ms iPhone commit", () => {
    expect(APPLE_COMMIT_MS).toBe(1200);
  });

  it("commits a stuck iPhone draft without stopping the session", () => {
    const t = setup(true);
    t.p.start();
    const rec = t.rec();
    rec.onstart?.();
    rec.result("hola hermanos", false);
    expect(t.commits.length).toBe(1);
    t.commits[0]();
    expect(t.finals).toEqual(["hola hermanos"]);
    expect(rec.stopped).toBe(0);
  });

  it("restarts within 250 ms after an ordinary silent end", () => {
    for (const apple of [true, false]) {
      const t = setup(apple);
      t.p.start();
      for (let i = 0; i < 4; i += 1) {
        const rec = t.rec();
        rec.onstart?.();
        rec.onend?.();
        const last = t.restarts.at(-1)!;
        expect(last.delay).toBeLessThanOrEqual(SILENCE_RESTART_CAP_MS);
        last.run();
      }
    }
  });

  it("still backs off after hard failures", () => {
    const t = setup(false);
    t.p.start();
    const rec = t.rec();
    rec.onstart?.();
    rec.onerror?.({ error: "network" });
    rec.onend?.();
    expect(t.restarts.at(-1)!.delay).toBeGreaterThan(SILENCE_RESTART_CAP_MS);
  });

  it("forgets the last commit on session end, so a repeated phrase is not dropped", () => {
    const t = setup(false);
    t.p.start();
    let rec = t.rec();
    rec.onstart?.();
    rec.result("amen", true);
    rec.onend?.();
    t.restarts.at(-1)!.run();
    rec = t.rec();
    rec.onstart?.();
    rec.result("amen", true);
    expect(t.finals).toEqual(["amen", "amen"]);
  });

  it("gives up with an error (which the views turn into a floor release) after repeated hard failures", () => {
    const t = setup(false);
    t.p.start();
    for (let i = 0; i < 10 && t.errors.length === 0; i += 1) {
      const rec = t.rec();
      rec.onerror?.({ error: "network" });
      rec.onend?.();
      t.restarts.at(-1)?.run();
    }
    expect(t.errors.length).toBeGreaterThan(0);
  });
});
