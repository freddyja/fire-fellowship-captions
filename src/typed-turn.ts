/**
 * A typed caption borrows the speaking turn without touching the microphone.
 *
 * Typing "Amen" must not flip the phone to Listening / You're speaking / STOP.
 * The turn is claimed just long enough to publish the line and its
 * translations, then released, unless the mic was switched on meanwhile (the
 * mic owns the turn from then on).
 */
export type TypedTurnDeps = {
  /** Already holding the speaking turn (mic on, or a typed turn not yet released). */
  holding: () => boolean;
  /** The local microphone is on. */
  micOn: () => boolean;
  claim: () => Promise<boolean>;
  release: () => Promise<unknown> | unknown;
  /** Grace period after the last typed caption settles, so quick follow-ups reuse the turn. */
  settleMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export type TypedTurn = {
  /** Make sure this phone holds the turn for one typed caption. False if someone else has it. */
  begin(): Promise<boolean>;
  /** That caption (and its translations) is done. */
  end(): void;
  /** True while a typed caption is holding a turn it claimed itself. */
  active(): boolean;
  /** Forget the typed turn without releasing (mic took over, or the turn was lost). */
  cancel(): void;
};

export const TYPED_SETTLE_MS = 1500;

export function createTypedTurn(deps: TypedTurnDeps): TypedTurn {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let inflight = 0;
  let owned = false;
  let timer: unknown = null;

  const stopTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const releaseIfIdle = () => {
    timer = null;
    if (inflight > 0 || !owned) return;
    owned = false;
    // The mic was switched on while typing: it keeps the turn.
    if (deps.micOn()) return;
    if (deps.holding()) void deps.release();
  };

  return {
    async begin() {
      stopTimer();
      if (!deps.holding()) {
        const ok = await deps.claim();
        if (!ok) return false;
        if (!deps.micOn()) owned = true;
      }
      inflight += 1;
      return true;
    },
    end() {
      if (inflight > 0) inflight -= 1;
      if (inflight > 0 || !owned) return;
      stopTimer();
      timer = setTimer(releaseIfIdle, deps.settleMs ?? TYPED_SETTLE_MS);
    },
    active() {
      return owned;
    },
    cancel() {
      stopTimer();
      owned = false;
      inflight = 0;
    },
  };
}

/**
 * The listening flag a phone sends with its captions. A typed turn sends none,
 * because the relay treats listening:false from the holder as "free the turn",
 * which would drop the translations that follow a typed line.
 */
export function wireListening(micOn: boolean, typedTurnActive: boolean): boolean | undefined {
  if (micOn) return true;
  return typedTurnActive ? undefined : false;
}

export type MicButton = {
  label: "start" | "stop" | "wait";
  pressed: boolean;
  hot: boolean;
  disabled: boolean;
};

/** The mic button reflects the microphone, not the speaking turn. */
export function micButtonState(opts: { holding: boolean; micOn: boolean; blocked: boolean }): MicButton {
  const on = opts.holding && opts.micOn;
  return {
    label: on ? "stop" : opts.blocked ? "wait" : "start",
    pressed: on,
    hot: on,
    disabled: opts.blocked,
  };
}
