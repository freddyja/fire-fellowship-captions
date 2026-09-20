/**
 * Open a TV caption URL via system Smart View / Cast settings (Android)
 * and, when available, Chrome’s Presentation API (Chromecast only).
 *
 * Samsung Smart View / “My TV” is not the Chrome Cast list. The Presentation
 * API only sees Google Cast / Chromecast receivers. A Samsung TV shows up
 * there only if it advertises built-in Cast — not because it is My TV.
 *
 * Android intents we try from Chrome / a Chrome PWA (needs a user tap).
 * Chrome only launches activities that declare BROWSABLE; if one is missing,
 * Chrome follows S.browser_fallback_url to the next intent.
 *
 *   1. Galaxy: com.samsung.android.smartmirroring (Smart View app)
 *   2. android.settings.CAST_SETTINGS (system Cast / wireless display)
 *   3. android.settings.WIFI_DISPLAY_SETTINGS (older wireless display)
 *
 * Not used (unreliable from Chrome): SmartThings (com.samsung.android.oneconnect)
 * does not open the Smart View picker in one tap; com.samsung.wfd.LAUNCH_WFD_PICKER_DLG
 * is a legacy Wi-Fi Display dialog and is often not BROWSABLE.
 *
 * If no intent launches, use Quick Settings → Smart View, or the TV link / QR.
 */

export type PresentOutcome = "presented" | "cancelled" | "no-screens" | "failed";

export type SmartViewResult =
  | { ok: true; method: "presentation" }
  | { ok: true; method: "android-settings"; emptyCastList?: boolean }
  | { ok: true; method: "copy" }
  | { ok: false; reason: "cancelled" }
  | { ok: false; reason: "no-screens" }
  | { ok: false; reason: "unavailable"; url: string };

export type SmartViewEnv = {
  userAgent?: string;
  isAndroid?: boolean;
  canPresent?: boolean;
  openIntent?: (url: string) => boolean;
  present?: (url: string) => Promise<PresentOutcome>;
  copy?: (url: string) => Promise<boolean>;
};

export const CAST_SETTINGS_INTENT = "intent:#Intent;action=android.settings.CAST_SETTINGS;end";
export const WIFI_DISPLAY_INTENT = "intent:#Intent;action=android.settings.WIFI_DISPLAY_SETTINGS;end";
export const SAMSUNG_SMART_VIEW_INTENT =
  "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.samsung.android.smartmirroring;end";

export const CAST_NOT_MY_TV =
  "Chrome’s Cast list is Chromecast only — not Samsung Smart View / My TV. Use system Smart View or the TV link.";

const ANDROID_SETTINGS_HINT =
  "Tried to open system Cast / Smart View settings. Pick My TV there, or swipe down → Smart View. Copy the TV link or scan the QR if you want the caption page on the TV.";

const PRESENTED = "TV caption page is presenting on a Cast / Chromecast display.";

const UNAVAILABLE =
  "This browser cannot open system Smart View or Chrome Cast. Copy the TV link or scan the QR, then open it on the TV.";

export const ANDROID_INTENT_NOTES = [
  "com.samsung.android.smartmirroring — Samsung Smart View app (Galaxy). Fallback if Chrome cannot launch it.",
  "android.settings.CAST_SETTINGS — Android Cast / wireless display settings.",
  "android.settings.WIFI_DISPLAY_SETTINGS — older wireless display settings.",
] as const;

type PresentationStart = {
  start: () => Promise<unknown>;
};

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
  if (typeof navigator === "undefined") return undefined;
  return (navigator as { presentation?: PresentationNav }).presentation;
}

export function canUsePresentationApi(): boolean {
  return Boolean(presentationCtor() || presentationNav()?.requestSession);
}

export function isAndroidUserAgent(ua: string): boolean {
  return /Android/i.test(ua);
}

export function isSamsungUserAgent(ua: string): boolean {
  return /SamsungBrowser/i.test(ua) || /Samsung/i.test(ua) || /SM-[A-Z0-9]+/i.test(ua);
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
    ?.platform;
  return isAndroidUserAgent(ua) || platform === "Android";
}

export function withIntentFallback(intentUrl: string, fallbackUrl: string): string {
  return intentUrl.replace(/;end$/, `;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`);
}

export function androidCastIntentUrl(userAgent: string): { url: string; chain: string[] } {
  const castThenWifi = withIntentFallback(CAST_SETTINGS_INTENT, WIFI_DISPLAY_INTENT);
  if (isSamsungUserAgent(userAgent)) {
    return {
      url: withIntentFallback(SAMSUNG_SMART_VIEW_INTENT, castThenWifi),
      chain: [
        "com.samsung.android.smartmirroring",
        "android.settings.CAST_SETTINGS",
        "android.settings.WIFI_DISPLAY_SETTINGS",
      ],
    };
  }
  return {
    url: castThenWifi,
    chain: ["android.settings.CAST_SETTINGS", "android.settings.WIFI_DISPLAY_SETTINGS"],
  };
}

export function openIntentUrl(url: string): boolean {
  if (typeof document === "undefined") return false;
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  link.setAttribute("aria-hidden", "true");
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
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

function errorName(error: unknown): string {
  if (!error || typeof error !== "object" || !("name" in error)) return "";
  return String(error.name);
}

function isUserCancel(error: unknown): boolean {
  const name = errorName(error);
  return name === "AbortError" || name === "NotAllowedError";
}

function isNoScreens(error: unknown): boolean {
  return errorName(error) === "NotFoundError";
}

async function presentTvUrl(url: string): Promise<PresentOutcome> {
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
    if (isNoScreens(error)) return "no-screens";
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

export async function startSmartView(url: string, env: SmartViewEnv = {}): Promise<SmartViewResult> {
  const ua = env.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const android = env.isAndroid ?? isAndroid();
  let androidOpened = false;

  if (android) {
    const intent = androidCastIntentUrl(ua);
    androidOpened = (env.openIntent ?? openIntentUrl)(intent.url);
  }

  const canPresent = env.canPresent ?? (env.present ? true : canUsePresentationApi());
  if (canPresent) {
    const presented = await (env.present ?? presentTvUrl)(url);
    if (presented === "presented") return { ok: true, method: "presentation" };
    if (presented === "cancelled") {
      if (androidOpened) return { ok: true, method: "android-settings" };
      return { ok: false, reason: "cancelled" };
    }
    if (presented === "no-screens") {
      return androidOpened
        ? { ok: true, method: "android-settings", emptyCastList: true }
        : { ok: false, reason: "no-screens" };
    }
  }

  if (androidOpened) return { ok: true, method: "android-settings" };

  const copied = await (env.copy ?? copyTvUrl)(url);
  if (copied) return { ok: true, method: "copy" };
  return { ok: false, reason: "unavailable", url };
}

export function smartViewMessage(result: SmartViewResult): string {
  if (result.ok && result.method === "presentation") return PRESENTED;
  if (result.ok && result.method === "android-settings") {
    return result.emptyCastList ? `${CAST_NOT_MY_TV} ${ANDROID_SETTINGS_HINT}` : ANDROID_SETTINGS_HINT;
  }
  if (!result.ok && (result.reason === "no-screens" || result.reason === "cancelled")) {
    return CAST_NOT_MY_TV;
  }
  if (result.ok && result.method === "copy") return `${CAST_NOT_MY_TV} TV link copied.`;
  if (!result.ok && result.reason === "unavailable") return `${UNAVAILABLE} ${result.url}`;
  return "";
}

export function smartViewWorkingLabel(): string {
  return isAndroid()
    ? "Opening system Cast / Smart View settings, then Chrome Cast if a Chromecast TV is available…"
    : "Looking for Cast / Chromecast displays (not Samsung My TV)…";
}
