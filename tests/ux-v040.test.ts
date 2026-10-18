import { describe, expect, it, vi } from "vitest";
import { patchLineText, provisionalText, settleUntranslated } from "../src/caption-history";
import { parseTvLayout } from "../src/router";
import { createTypedTurn, micButtonState, wireListening } from "../src/typed-turn";
import { HOST_LAYOUT_IDS, isWatchPref, langsForLayout, langsForWatch, layoutForWatch, parseLayout, type CaptionLine } from "../src/types";
import { lineShowsIn, speakerLabels } from "../src/views/caption-board";

describe("two-language watch", () => {
  it("offers pairs alongside one language and all three", () => {
    expect(HOST_LAYOUT_IDS).toEqual(["en", "es", "pt", "en-es", "en-pt", "es-pt", "en-es-pt"]);
    expect(isWatchPref("en-es")).toBe(true);
    expect(isWatchPref("es-pt")).toBe(true);
    expect(isWatchPref("en-es-pt")).toBe(false);
    expect(langsForWatch("en-pt")).toEqual(["en", "pt"]);
    expect(layoutForWatch("es-pt")).toBe("es-pt");
    expect(langsForLayout("en-es")).toEqual(["en", "es"]);
  });

  it("reads a pair from the TV &lang= URL in any order or separator", () => {
    for (const parse of [parseLayout, parseTvLayout]) {
      expect(parse("en-es")).toBe("en-es");
      expect(parse("ES|EN")).toBe("en-es");
      expect(parse("pt,es")).toBe("es-pt");
      expect(parse("es")).toBe("es");
      expect(parse("all")).toBe("en-es-pt");
      expect(parse("en-fr")).toBeUndefined();
      expect(parse("")).toBeUndefined();
    }
  });
});

describe("typed caption does not toggle the mic", () => {
  function world(opts: { micOn?: boolean; claimOk?: boolean } = {}) {
    let holding = false;
    let micOn = opts.micOn ?? false;
    const claim = vi.fn(async () => {
      if (opts.claimOk === false) return false;
      holding = true;
      return true;
    });
    const release = vi.fn(async () => {
      holding = false;
    });
    const timers: Array<() => void> = [];
    const turn = createTypedTurn({
      holding: () => holding,
      micOn: () => micOn,
      claim,
      release,
      setTimer: (fn) => timers.push(fn),
      clearTimer: () => timers.splice(0),
    });
    return {
      turn,
      claim,
      release,
      fire: () => timers.splice(0).forEach((fn) => fn()),
      setMic: (on: boolean) => (micOn = on),
      setHolding: (on: boolean) => (holding = on),
      isHolding: () => holding,
    };
  }

  it("claims the turn for the line, then releases it, mic untouched", async () => {
    const w = world();
    expect(await w.turn.begin()).toBe(true);
    expect(w.claim).toHaveBeenCalledTimes(1);
    expect(w.turn.active()).toBe(true);
    // Mic button still says Start while the typed line holds the turn.
    expect(micButtonState({ holding: true, micOn: false, blocked: false })).toMatchObject({ label: "start", pressed: false, hot: false });
    // Nothing on the wire says "listening", and nothing says "free the turn" before the translation lands.
    expect(wireListening(false, w.turn.active())).toBeUndefined();
    w.turn.end();
    w.fire();
    expect(w.release).toHaveBeenCalledTimes(1);
    expect(w.isHolding()).toBe(false);
    expect(w.turn.active()).toBe(false);
    expect(wireListening(false, w.turn.active())).toBe(false);
  });

  it("does not release a turn the mic already had", async () => {
    const w = world({ micOn: true });
    w.setHolding(true);
    expect(await w.turn.begin()).toBe(true);
    expect(w.claim).not.toHaveBeenCalled();
    w.turn.end();
    w.fire();
    expect(w.release).not.toHaveBeenCalled();
    expect(micButtonState({ holding: true, micOn: true, blocked: false }).label).toBe("stop");
    expect(wireListening(true, false)).toBe(true);
  });

  it("keeps the turn if the mic is switched on before the release", async () => {
    const w = world();
    await w.turn.begin();
    w.setMic(true);
    w.turn.end();
    w.fire();
    expect(w.release).not.toHaveBeenCalled();
  });

  it("reuses the turn for quick follow-up lines and releases once", async () => {
    const w = world();
    await w.turn.begin();
    await w.turn.begin();
    w.turn.end();
    w.fire();
    expect(w.release).not.toHaveBeenCalled();
    w.turn.end();
    w.fire();
    expect(w.release).toHaveBeenCalledTimes(1);
    expect(w.claim).toHaveBeenCalledTimes(1);
  });

  it("reports busy when someone else has the turn", async () => {
    const w = world({ claimOk: false });
    expect(await w.turn.begin()).toBe(false);
    expect(w.turn.active()).toBe(false);
    expect(micButtonState({ holding: false, micOn: false, blocked: true })).toMatchObject({ label: "wait", disabled: true });
  });
});

describe("no flash of untranslated text", () => {
  const line = (): CaptionLine => ({
    id: "a",
    isFinal: true,
    pending: true,
    text: provisionalText("Welcome brothers", "en"),
    at: 1,
  });

  it("puts the original only in its own language until translations arrive", () => {
    const l = line();
    expect(l.text).toEqual({ en: "Welcome brothers", es: "", pt: "" });
    expect(lineShowsIn(l, "es")).toBe(true); // shown as "traduciendo…"
    const patched = patchLineText([l], "a", { en: "x", es: "Bienvenidos hermanos", pt: "Bem-vindos irmãos" }, "en")[0];
    expect(patched.text).toEqual({ en: "Welcome brothers", es: "Bienvenidos hermanos", pt: "Bem-vindos irmãos" });
    expect(patched.pending).toBeUndefined();
  });

  it("falls back to the original words if translation fails", () => {
    const settled = settleUntranslated([line()], "a", "en")[0];
    expect(settled.text).toEqual({ en: "Welcome brothers", es: "Welcome brothers", pt: "Welcome brothers" });
    expect(settled.pending).toBeUndefined();
  });
});

describe("speaker labels", () => {
  it("hides the label when one person is speaking all along", () => {
    expect(speakerLabels(["Host", "Host", "Host"])).toEqual(["", "", ""]);
  });
  it("shows a name only where the speaker changes", () => {
    expect(speakerLabels(["Host", "Host", "Pedro", "Pedro", "Host"])).toEqual(["Host", "", "Pedro", "", "Host"]);
  });
});
