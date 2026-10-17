import { isAppleMobile } from "./capability.ts";

export type SpeechResult = {
  text: string;
  isFinal: boolean;
};

export type SpeechProvider = {
  readonly supported: boolean;
  start(): void;
  stop(): void;
  /**
   * `prime` creates the single iOS recognizer and writes `lang` now.
   * WebKit keeps the first object's language, and an idle `setLang` that only
   * stores a string leaves that object (or `<html lang>`) on English until start.
   */
  setLang(locale: string, prime?: boolean): void;
  onResult: ((result: SpeechResult) => void) | null;
  onError: ((message: string) => void) | null;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

export type WebSpeechOptions = {
  /** When omitted, detected from the user agent. */
  appleMobile?: boolean;
  /** Injected in tests. Omitted means `webkitSpeechRecognition` / `SpeechRecognition`. */
  recognitionCtor?: RecognitionCtor | null;
  /**
   * Auto-restart after a session ends. `delayMs` is the backoff for this attempt.
   * Tests run this immediately instead of waiting on a timer.
   */
  scheduleRestart?: (run: () => void, delayMs: number) => void;
  /** iOS often never sets `isFinal`. Tests commit the draft immediately. */
  scheduleCommit?: (run: () => void) => void;
  /** Silent start (no onstart / result / end). Tests run this immediately. */
  scheduleWatchdog?: (run: () => void) => void;
};

const IPHONE_TYPE =
  "iPhone couldn't capture speech. Type a caption — Send still reaches every phone and the TV.";

const IPHONE_NO_SPEECH =
  "iPhone heard nothing (no-speech). Type a caption — Send still reaches every phone and the TV.";

/** Safari kept refusing to reopen the mic between phrases. A tap restarts it. */
const IPHONE_TAP_AGAIN =
  "iPhone paused the microphone. Tap Start to keep talking, or type a caption.";

const MIC_STOPPED = "The microphone stopped. Tap Start to keep talking, or type a caption.";

/** Errors we ride through by restarting while the user still wants the mic. */
const RECOVERABLE_ERRORS = new Set(["no-speech", "aborted", "network"]);

/** Give up after this many restarts in a row that never reach the speech engine. */
const MAX_HARD_FAILURES = 5;

/** Shown when Safari fires `language-not-supported` for the locale we asked for. */
export function localeRejectedMessage(locale: string, code: string): string {
  return `Safari rejected ${locale} (${code}). Type a caption — Send still reaches every phone and the TV.`;
}

export function isSpeechFallbackMessage(message: string): boolean {
  return (
    message.includes("Type a caption") ||
    message.includes("Microphone blocked") ||
    message.includes("no Web Speech") ||
    message.includes("microphone stopped") ||
    message.includes("Tap Start to keep talking")
  );
}

/** A pause with no words. The mic stays up so the next phrase can still publish. */
export function isNonFatalSpeechNote(message: string): boolean {
  return message.includes("(no-speech)");
}

function alternativeTranscript(chunk: SpeechRecognitionResultEvent["results"][number]): string {
  const alternative = chunk[0];
  if (!alternative || typeof alternative.transcript !== "string") return "";
  return alternative.transcript.trim();
}

function alreadyStarted(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name: unknown }).name) : "";
  const message = err instanceof Error ? err.message : String(err);
  return name === "InvalidStateError" || /already started|invalidstate/i.test(`${name} ${message}`);
}

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** iPhone: commit a still-interim phrase after this much quiet. */
export const APPLE_COMMIT_MS = 1200;
/** iPhone: a start() that never reports life within this window is retried. */
export const WATCHDOG_MS = 2500;
/** Restart cap after a normal end-of-phrase silence. Hard failures still back off. */
export const SILENCE_RESTART_CAP_MS = 250;

export function createWebSpeechProvider(options: WebSpeechOptions = {}): SpeechProvider {
  const apple = options.appleMobile ?? isAppleMobile();
  const Ctor = options.recognitionCtor === undefined ? getRecognitionCtor() : options.recognitionCtor;
  const scheduleRestart =
    options.scheduleRestart ??
    ((run: () => void, delayMs: number) => {
      window.setTimeout(run, delayMs);
    });
  const scheduleCommit =
    options.scheduleCommit ??
    ((run: () => void) => {
      window.setTimeout(run, APPLE_COMMIT_MS);
    });
  const scheduleWatchdog =
    options.scheduleWatchdog ??
    ((run: () => void) => {
      window.setTimeout(run, WATCHDOG_MS);
    });

  let rec: SpeechRecognitionLike | null = null;
  let locale = "en-US";
  let wantListening = false;
  let generation = 0;
  let commitToken = 0;
  let watchdogToken = 0;
  let draft = "";
  let lastCommitted = "";
  let aborting = false;
  let sessionAlive = false;
  /** Sessions in a row that ended without words. Only stretches the backoff. */
  let quietStreak = 0;
  /** Restarts in a row that failed to reach the engine (throw, network, refused). */
  let hardFailures = 0;
  /** True once any session since the user's Start tap has run. */
  let autoRestarting = false;
  let noSpeechNoted = false;
  let visibilityWait: (() => void) | null = null;

  const provider: SpeechProvider = {
    supported: Boolean(Ctor),
    onResult: null,
    onError: null,
    setLang(next, prime = false) {
      const localeNext = next.trim() || locale;
      const changed = localeNext !== locale;
      locale = localeNext;
      // WebKit uses the document language when SpeechRecognition.lang is still empty.
      syncDocumentLang();
      // Spoken is chosen before Start, and again while the mic is idle.
      // Stamp es-ES / pt-BR on the one iOS object now — not only inside start().
      if (apple && Ctor && (prime || rec)) {
        if (!rec) rec = new Ctor();
        rec.lang = locale;
      }
      if (!changed || !wantListening) return;
      // Chrome ignores lang on a live recognizer, so rebuild in this tap.
      // iOS ignores lang on every object after the first. Keep that object.
      if (apple) reviveApple();
      else begin(true);
    },
    start() {
      if (!Ctor) {
        provider.onError?.("This browser has no Web Speech. Type a caption instead.");
        return;
      }
      wantListening = true;
      quietStreak = 0;
      hardFailures = 0;
      autoRestarting = false;
      noSpeechNoted = false;
      clearVisibilityWait();
      begin(true);
    },
    stop() {
      wantListening = false;
      generation += 1;
      cancelCommit();
      watchdogToken += 1;
      draft = "";
      lastCommitted = "";
      aborting = false;
      sessionAlive = false;
      autoRestarting = false;
      clearVisibilityWait();
      const mine = rec;
      // Drop the desktop object. On iOS the next Start must reuse it or the
      // engine keeps the first session's language (English).
      if (!apple) rec = null;
      detachAndAbort(mine);
    },
  };

  function syncDocumentLang() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!root || root.lang === locale) return;
    root.lang = locale;
  }

  function cancelCommit() {
    commitToken += 1;
  }

  function commitDraft(): boolean {
    const text = draft.trim();
    draft = "";
    cancelCommit();
    if (!text || text === lastCommitted) return false;
    lastCommitted = text;
    provider.onResult?.({ text, isFinal: true });
    return true;
  }

  function markAlive() {
    sessionAlive = true;
  }

  function detachAndAbort(mine: SpeechRecognitionLike | null) {
    if (!mine) return;
    mine.onstart = null;
    mine.onaudiostart = null;
    mine.onresult = null;
    mine.onerror = null;
    mine.onend = null;
    try {
      mine.abort();
    } catch {
      /* already idle */
    }
  }

  function begin(surfaceStartFailure: boolean) {
    if (!Ctor) return;
    const gen = ++generation;
    syncDocumentLang();
    if (apple) {
      if (!rec) rec = new Ctor();
      rec.lang = locale;
      kick(rec, gen, surfaceStartFailure);
      return;
    }
    const previous = rec;
    if (previous) {
      previous.onstart = null;
      previous.onaudiostart = null;
      previous.onresult = null;
      previous.onerror = null;
      previous.onend = null;
      try {
        previous.abort();
      } catch {
        /* idle */
      }
    }
    rec = new Ctor();
    kick(rec, gen, surfaceStartFailure);
  }

  /** Point the original iOS recognizer at the new locale and start it in this tap. */
  function reviveApple() {
    if (!rec || !Ctor) return;
    // Publish whatever Safari already heard before the locale changes.
    commitDraft();
    const gen = ++generation;
    const mine = rec;
    // Idle (including the gap after a one-shot onend): start() in this tap.
    // Still live: start() throws, abort ends it, and onend starts the new locale.
    if (kick(mine, gen, true)) return;
    try {
      mine.abort();
    } catch {
      /* already ending */
    }
  }

  function kick(mine: SpeechRecognitionLike, gen: number, surfaceStartFailure: boolean): boolean {
    arm(mine, gen);
    try {
      mine.lang = locale;
      mine.start();
      if (apple) armWatchdog(mine, gen);
      return true;
    } catch (err) {
      // Live session: caller aborts and onend starts the new locale.
      if (alreadyStarted(err) || gen !== generation) return false;
      if (!surfaceStartFailure) return false;
      wantListening = false;
      provider.onError?.(
        err instanceof Error && err.message
          ? err.message
          : apple
            ? IPHONE_TYPE
            : "Could not start the microphone.",
      );
      return false;
    }
  }

  function armWatchdog(mine: SpeechRecognitionLike, gen: number) {
    const token = ++watchdogToken;
    const auto = autoRestarting;
    scheduleWatchdog(() => {
      if (token !== watchdogToken || gen !== generation || !wantListening || sessionAlive) return;
      if (auto) {
        // A silent auto-restart: try again a few times before asking for a tap.
        hardFailures += 1;
        try {
          mine.abort();
        } catch {
          /* never started */
        }
        if (hardFailures >= MAX_HARD_FAILURES) {
          giveUp(IPHONE_TAP_AGAIN);
          return;
        }
        restart(gen);
        return;
      }
      wantListening = false;
      cancelCommit();
      draft = "";
      try {
        mine.abort();
      } catch {
        /* never started */
      }
      provider.onError?.(IPHONE_TYPE);
    });
  }

  function scheduleDraftCommit(mine: SpeechRecognitionLike, gen: number) {
    if (!apple) return;
    const token = ++commitToken;
    scheduleCommit(() => {
      if (token !== commitToken || gen !== generation || !wantListening) return;
      // Publish only. Calling stop() here cut the speaker off mid-sentence after a
      // short breath; Safari ends the one-shot itself and onend restarts it.
      void mine;
      commitDraft();
    });
  }

  function clearVisibilityWait() {
    if (!visibilityWait) return;
    document.removeEventListener("visibilitychange", visibilityWait);
    visibilityWait = null;
  }

  /** Stop for good, keeping any words already heard, and tell the UI why. */
  function giveUp(message: string) {
    commitDraft();
    wantListening = false;
    generation += 1;
    cancelCommit();
    watchdogToken += 1;
    clearVisibilityWait();
    const mine = rec;
    if (!apple) rec = null;
    detachAndAbort(mine);
    provider.onError?.(message);
  }

  function backoffMs(): number {
    const base = apple ? 250 : 150;
    if (hardFailures === 0) {
      // Ordinary silence between phrases: come back fast so the next words are heard.
      return Math.min(base, SILENCE_RESTART_CAP_MS);
    }
    const steps = Math.min(quietStreak + hardFailures * 2, 4);
    return Math.min(base * 2 ** steps, 2500);
  }

  /**
   * Keep listening until the user taps Stop. Each restart is a fresh generation
   * with fresh result bookkeeping: engines number results from 0 again in every
   * session, so reusing the old index set would drop the next phrase's finals.
   */
  function restart(gen: number) {
    scheduleRestart(() => {
      if (gen !== generation || !wantListening) return;
      // A backgrounded tab cannot open the mic. Wait until it is visible again.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        clearVisibilityWait();
        visibilityWait = () => {
          if (document.visibilityState !== "visible") return;
          clearVisibilityWait();
          if (gen === generation && wantListening) relaunch();
        };
        document.addEventListener("visibilitychange", visibilityWait);
        return;
      }
      relaunch();
    }, backoffMs());
  }

  function relaunch() {
    if (!Ctor || !wantListening) return;
    autoRestarting = true;
    const gen = ++generation;
    let mine: SpeechRecognitionLike;
    if (apple) {
      // iOS keeps the first object's language. Reuse it so es-ES / pt-BR stick.
      if (!rec) rec = new Ctor();
      mine = rec;
    } else {
      // Chrome/Android: a fresh object per session is the most reliable restart.
      detachAndAbort(rec);
      rec = new Ctor();
      mine = rec;
    }
    arm(mine, gen);
    try {
      mine.lang = locale;
      mine.start();
      if (apple) armWatchdog(mine, gen);
    } catch (err) {
      // Still live from the last session: its onend (now armed) restarts us.
      if (alreadyStarted(err) || gen !== generation) return;
      hardFailures += 1;
      if (hardFailures >= MAX_HARD_FAILURES) {
        giveUp(apple ? IPHONE_TAP_AGAIN : MIC_STOPPED);
        return;
      }
      restart(gen);
    }
  }

  function arm(mine: SpeechRecognitionLike, gen: number) {
    mine.lang = locale;
    // Continuous where it works. iOS Safari's continuous mode repeats and never
    // finalizes phrases, so iPhone stays one-shot and is restarted between phrases.
    mine.continuous = !apple;
    mine.interimResults = true;
    mine.maxAlternatives = 1;
    draft = "";
    aborting = false;
    sessionAlive = false;
    cancelCommit();
    const emittedFinals = new Set<number>();
    let heardWords = false;
    let hardError = false;

    const noteAlive = () => {
      if (gen !== generation) return;
      markAlive();
    };
    mine.onstart = noteAlive;
    mine.onaudiostart = noteAlive;

    mine.onresult = (event) => {
      if (gen !== generation) return;
      markAlive();
      heardWords = true;
      quietStreak = 0;
      hardFailures = 0;
      noSpeechNoted = false;
      let interim = "";
      // Walk the whole list: Chrome on Android often reports resultIndex 0
      // on every event and would re-emit earlier finals as new history lines.
      for (let i = 0; i < event.results.length; i += 1) {
        const chunk = event.results[i];
        const text = alternativeTranscript(chunk);
        if (!text) continue;
        if (chunk.isFinal) {
          if (!emittedFinals.has(i) && text !== lastCommitted) {
            emittedFinals.add(i);
            lastCommitted = text;
            cancelCommit();
            provider.onResult?.({ text, isFinal: true });
          }
        } else {
          interim += `${text} `;
        }
      }
      draft = interim.trim();
      if (apple && draft && draft !== lastCommitted) scheduleDraftCommit(mine, gen);
      else if (!draft) cancelCommit();
      provider.onResult?.({ text: draft, isFinal: false });
    };

    mine.onerror = (event) => {
      if (gen !== generation) return;
      markAlive();
      const code = event.error;
      if (code === "aborted") {
        aborting = true;
        return;
      }
      if (code === "no-speech") {
        // iOS 18 reports heard speech as no-speech, or ends a pause this way.
        // Words we already have must publish. onend restarts the mic.
        if (draft.trim() && draft.trim() !== lastCommitted) {
          commitDraft();
          return;
        }
        // Show the pause once per Start, not on every silent restart.
        if (apple && !draft.trim() && !noSpeechNoted) {
          noSpeechNoted = true;
          provider.onError?.(IPHONE_NO_SPEECH);
        }
        return;
      }
      if (RECOVERABLE_ERRORS.has(code)) {
        // network: the speech service blipped. Keep heard words; onend retries with backoff.
        commitDraft();
        hardError = true;
        return;
      }
      if (code === "language-not-supported") {
        wantListening = false;
        provider.onError?.(localeRejectedMessage(locale, code));
        return;
      }
      if ((code === "not-allowed" || code === "service-not-allowed") && autoRestarting) {
        // The user already granted the mic this Start. A refusal on an automatic
        // restart is WebKit wanting a fresh tap; retry briefly, then ask for one.
        commitDraft();
        hardError = true;
        return;
      }
      wantListening = false;
      if (code === "not-allowed") {
        provider.onError?.(
          apple
            ? IPHONE_TYPE
            : "Microphone blocked. Allow mic access for this site, or type a caption.",
        );
        return;
      }
      if (apple) {
        // Keep a transcript Safari delivered before the error.
        commitDraft();
        provider.onError?.(IPHONE_TYPE);
        return;
      }
      commitDraft();
      provider.onError?.(code);
    };

    mine.onend = () => {
      if (gen !== generation || !wantListening) return;
      const skipped = aborting;
      aborting = false;
      // WebKit often leaves isFinal false and only then ends the one-shot.
      // Chrome can also end mid-phrase. Publish the last hypothesis either way.
      if (!skipped) commitDraft();
      // A new session numbers results from 0 and may repeat the last phrase's
      // words legitimately; forget the previous commit so it is not dropped.
      lastCommitted = "";
      if (hardError) {
        hardFailures += 1;
        if (hardFailures >= MAX_HARD_FAILURES) {
          giveUp(apple ? IPHONE_TAP_AGAIN : MIC_STOPPED);
          return;
        }
      } else if (!heardWords) {
        quietStreak += 1;
        if (sessionAlive) hardFailures = 0;
      }
      restart(gen);
    };
  }

  return provider;
}
