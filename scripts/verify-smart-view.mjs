import { tvQrSvg } from "../src/qr.ts";
import {
  androidCastIntentUrl,
  CAST_NOT_MY_TV,
  CAST_SETTINGS_INTENT,
  isAndroidUserAgent,
  isSamsungUserAgent,
  SAMSUNG_SMART_VIEW_INTENT,
  smartViewMessage,
  startSmartView,
  WIFI_DISPLAY_INTENT,
  withIntentFallback,
} from "../src/smart-view.ts";

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const foldUa =
  "Mozilla/5.0 (Linux; Android 16; SM-F966U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const pixelUa =
  "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const desktopUa =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

assert(isAndroidUserAgent(foldUa), "Fold UA is Android");
assert(isSamsungUserAgent(foldUa), "SM-F966U is Samsung");
assert(isAndroidUserAgent(pixelUa) && !isSamsungUserAgent(pixelUa), "Pixel is Android, not Samsung");
assert(!isAndroidUserAgent(desktopUa) && !isSamsungUserAgent(desktopUa), "desktop is neither");

const samsung = androidCastIntentUrl(foldUa);
assert(samsung.chain[0] === "com.samsung.android.smartmirroring", "Galaxy starts with Smart View app");
assert(samsung.chain.includes("android.settings.CAST_SETTINGS"), "Galaxy falls back to CAST_SETTINGS");
assert(samsung.chain.includes("android.settings.WIFI_DISPLAY_SETTINGS"), "Galaxy falls back to WIFI_DISPLAY");
assert(samsung.url.includes("com.samsung.android.smartmirroring"), "Galaxy intent package");
assert(samsung.url.includes("S.browser_fallback_url="), "Galaxy intent has Chrome fallback");
assert(
  decodeURIComponent(samsung.url).includes("android.settings.CAST_SETTINGS"),
  "Galaxy fallback decodes to CAST_SETTINGS",
);

const android = androidCastIntentUrl(pixelUa);
assert(android.chain[0] === "android.settings.CAST_SETTINGS", "non-Samsung Android starts with CAST_SETTINGS");
assert(!android.url.includes("smartmirroring"), "non-Samsung does not open Smart View app");
assert(android.url.startsWith("intent:#Intent;action=android.settings.CAST_SETTINGS"), "CAST_SETTINGS first");

const chained = withIntentFallback(SAMSUNG_SMART_VIEW_INTENT, CAST_SETTINGS_INTENT);
assert(chained.endsWith(";end"), "intent still terminated");
assert(chained.includes(encodeURIComponent(CAST_SETTINGS_INTENT)), "fallback is encoded");
assert(WIFI_DISPLAY_INTENT.includes("WIFI_DISPLAY_SETTINGS"), "wifi display intent");

const tvUrl = "https://example.test/?view=tv&room=ABCD";
const opened = [];

const presented = await startSmartView(tvUrl, {
  isAndroid: true,
  userAgent: foldUa,
  openIntent: (url) => {
    opened.push(url);
    return true;
  },
  present: async () => "presented",
});
assert(presented.ok && presented.method === "presentation", "Cast success still wins");
assert(opened.length === 1, "Android still fires the system intent first");

const emptyCast = await startSmartView(tvUrl, {
  isAndroid: true,
  userAgent: foldUa,
  openIntent: () => true,
  present: async () => "no-screens",
});
assert(emptyCast.ok && emptyCast.method === "android-settings" && emptyCast.emptyCastList, "empty Cast + settings");
assert(smartViewMessage(emptyCast).includes(CAST_NOT_MY_TV), "empty-list message is honest");
assert(smartViewMessage(emptyCast).includes("system Cast / Smart View"), "empty-list keeps system path");

const noScreensDesktop = await startSmartView(tvUrl, {
  isAndroid: false,
  userAgent: desktopUa,
  present: async () => "no-screens",
  copy: async () => false,
});
assert(!noScreensDesktop.ok && noScreensDesktop.reason === "no-screens", "desktop empty Cast");
assert(smartViewMessage(noScreensDesktop) === CAST_NOT_MY_TV, "desktop empty-list copy");

const cancelled = await startSmartView(tvUrl, {
  isAndroid: true,
  userAgent: foldUa,
  openIntent: () => true,
  present: async () => "cancelled",
});
assert(cancelled.ok && cancelled.method === "android-settings", "dismissed Cast picker still counts settings");

const cancelledDesktop = await startSmartView(tvUrl, {
  isAndroid: false,
  userAgent: desktopUa,
  present: async () => "cancelled",
  copy: async () => false,
});
assert(!cancelledDesktop.ok && cancelledDesktop.reason === "cancelled", "desktop Cast cancel");
assert(smartViewMessage(cancelledDesktop) === CAST_NOT_MY_TV, "desktop cancel still explains Cast vs My TV");

const copyOnly = await startSmartView(tvUrl, {
  isAndroid: false,
  canPresent: false,
  copy: async () => true,
});
assert(copyOnly.ok && copyOnly.method === "copy", "copy fallback");
assert(smartViewMessage(copyOnly).includes("TV link copied"), "copy mentions TV link");

assert(
  smartViewMessage({ ok: true, method: "presentation" }).includes("Cast / Chromecast"),
  "presentation message does not say My TV",
);

const qr = tvQrSvg(tvUrl);
assert(qr.includes("<svg"), "QR is SVG");
assert(qr.includes("viewBox"), "QR has viewBox");
assert(qr.includes("#120c09"), "QR uses brand dark");
assert(qr.includes("#f4ead8"), "QR uses brand cream");

console.log("OK smart-view intents, empty-list copy, Presentation fallback, QR");
