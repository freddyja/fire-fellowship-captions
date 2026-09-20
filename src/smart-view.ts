/** Cast / Smart View the TV caption URL — never the phone control UI. */

export type SmartViewResult =
  | { ok: true; method: "presentation" }
  | { ok: true; method: "share" }
  | { ok: true; method: "copy" }
  | { ok: false; reason: "cancelled" }
  | { ok: false; reason: "unavailable"; url: string };

const UNAVAILABLE =
  "Smart View isn’t available in this browser. TV link copied — open it on the TV, or use Chrome on Android.";

type PresentationStart = { start: () => Promise<unknown> };

type PresentationCtor = new (url: string) => PresentationStart;

type PresentationNav = {
  defaultRequest?: PresentationStart | null;
  requestSession?: (url: string) => Promise<unknown>;
};

/** Chrome keeps a live session if we hold the connection. */
let activePresentation: unknown = null;

function presentationCtor(): PresentationCtor | undefined {
  const ctor = (globalThis as { PresentationRequest?: PresentationCtor }).PresentationRequest;
  return typeof ctor === "function" ? ctor : undefined;
}

function presentationNav(): PresentationNav | undefined {
  return (navigator as { presentation?: PresentationNav }).presentation;
}

export function canUsePresentationApi(): boolean {
  return Boolean(presentationCtor() || presentationNav()?.requestSession);
}

/** Point Chrome’s cast affordance at the TV page so it does not mirror the phone. */
export function bindDefaultPresentation(url: string): void {
  const Ctor = presentationCtor();
  const nav = presentationNav();
  if (!Ctor || !nav) return;
  nav.defaultRequest = new Ctor(url);
}

export function clearDefaultPresentation(): void {
  const nav = presentationNav();
  if (nav) nav.defaultRequest = null;
}

function isUserCancel(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError" || name === "NotAllowedError";
}

async function presentTvUrl(url: string): Promise<"presented" | "cancelled" | "failed"> {
  try {
    const Ctor = presentationCtor();
    if (Ctor) {
      const request = new Ctor(url);
      activePresentation = await request.start();
      return activePresentation ? "presented" : "failed";
    }
    const requestSession = presentationNav()?.requestSession;
    if (requestSession) {
      activePresentation = await requestSession.call(presentationNav(), url);
      return activePresentation ? "presented" : "failed";
    }
    return "failed";
  } catch (error) {
    if (isUserCancel(error)) return "cancelled";
    return "failed";
  }
}

async function shareTvUrl(url: string): Promise<"shared" | "cancelled" | "failed"> {
  if (typeof navigator.share !== "function") return "failed";
  try {
    await navigator.share({
      title: "Fire and Fellowship",
      text: "Open the Fire and Fellowship TV captions.",
      url,
    });
    return "shared";
  } catch (error) {
    if (isUserCancel(error)) return "cancelled";
    return "failed";
  }
}

async function copyTvUrl(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export async function startSmartView(url: string): Promise<SmartViewResult> {
  if (canUsePresentationApi()) {
    const presented = await presentTvUrl(url);
    if (presented === "presented") return { ok: true, method: "presentation" };
    if (presented === "cancelled") return { ok: false, reason: "cancelled" };
  }

  const shared = await shareTvUrl(url);
  if (shared === "shared") return { ok: true, method: "share" };
  if (shared === "cancelled") return { ok: false, reason: "cancelled" };

  const copied = await copyTvUrl(url);
  if (copied) return { ok: true, method: "copy" };
  return { ok: false, reason: "unavailable", url };
}

export function smartViewMessage(result: SmartViewResult): string {
  if (result.ok && result.method === "presentation") {
    return "TV caption page is presenting on the chosen display.";
  }
  if (result.ok && result.method === "share") return "TV link shared.";
  if (result.ok && result.method === "copy") return UNAVAILABLE;
  if (!result.ok && result.reason === "unavailable") return `${UNAVAILABLE} ${result.url}`;
  return "";
}
