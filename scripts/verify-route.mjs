import { joinSearch, parseRoute, parseTvLang, tvSearch } from "../src/router.ts";
import { detectSpeechCapability, isAppleMobile } from "../src/stt/capability.ts";

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function same(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)}`);
}

assert(parseTvLang("en") === "en", "parseTvLang en");
assert(parseTvLang("ES") === "es", "parseTvLang is case-insensitive");
assert(parseTvLang(" pt ") === "pt", "parseTvLang trims");
assert(parseTvLang("fr") === undefined, "parseTvLang ignores unknown");
assert(parseTvLang("en-es") === undefined, "parseTvLang ignores layout ids");
assert(parseTvLang("") === undefined, "parseTvLang empty");
assert(parseTvLang(null) === undefined, "parseTvLang null");

same(parseRoute(""), { view: "home", room: "" }, "empty search is home");
same(parseRoute("?view=tv&room=ABCD"), { view: "tv", room: "ABCD" }, "TV without lang omits lang");
same(
  parseRoute("?view=tv&room=abcd&lang=es"),
  { view: "tv", room: "ABCD", lang: "es" },
  "TV lang=es is a local override",
);
same(
  parseRoute("view=tv&room=ABCD&lang=PT"),
  { view: "tv", room: "ABCD", lang: "pt" },
  "TV lang is case-insensitive",
);
same(
  parseRoute("?view=tv&room=ABCD&lang=fr"),
  { view: "tv", room: "ABCD" },
  "unknown lang= does not lock a language",
);
same(
  parseRoute("?view=phone&room=ABCD&lang=es"),
  { view: "phone", room: "ABCD", role: "host" },
  "lang= on phone is ignored",
);
same(parseRoute("?lang=es"), { view: "home", room: "" }, "lang= without TV view is ignored");
same(
  parseRoute("?view=join&room=abcd"),
  { view: "join", room: "ABCD", role: "guest" },
  "join view is a guest phone",
);
same(
  parseRoute("?view=phone&room=ABCD&role=guest"),
  { view: "phone", room: "ABCD", role: "guest" },
  "phone role=guest is the brothers join path",
);
same(
  parseRoute("?view=phone&room=ABCD"),
  { view: "phone", room: "ABCD", role: "host" },
  "phone without role stays the host Fold",
);

assert(tvSearch("ABCD") === "view=tv&room=ABCD", "combined TV query has no lang");
assert(tvSearch("ABCD", "es") === "view=tv&room=ABCD&lang=es", "per-language TV query");
assert(tvSearch("ABCD", "en") === "view=tv&room=ABCD&lang=en", "en TV query");
assert(tvSearch("ABCD", "pt") === "view=tv&room=ABCD&lang=pt", "pt TV query");
assert(joinSearch("ABCD") === "view=join&room=ABCD", "brothers join query");

assert(isAppleMobile("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "iPhone", 5), "iPhone UA is Apple mobile");
assert(isAppleMobile("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0.0.0", "iPhone", 5), "iPhone Chrome is still Apple mobile");
assert(!isAppleMobile("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0.0.0 Mobile", "Linux armv8l", 5), "Android is not Apple mobile");

const iphoneNoStt = detectSpeechCapability({
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  platform: "iPhone",
  maxTouchPoints: 5,
  secureContext: true,
  hasSpeechCtor: false,
});
assert(iphoneNoStt.canListen === false && iphoneNoStt.preferType === true, "iPhone without Web Speech types captions");

const iphoneWithStt = detectSpeechCapability({
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  platform: "iPhone",
  maxTouchPoints: 5,
  secureContext: true,
  hasSpeechCtor: true,
});
assert(iphoneWithStt.canListen === true && iphoneWithStt.preferType === true, "iPhone with Web Speech still prefers type fallback");

const androidChrome = detectSpeechCapability({
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0.0.0 Mobile",
  platform: "Linux armv8l",
  maxTouchPoints: 5,
  secureContext: true,
  hasSpeechCtor: true,
});
assert(androidChrome.canListen === true && androidChrome.preferType === false, "Android Chrome uses live speech");

const httpLan = detectSpeechCapability({
  userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile",
  secureContext: false,
  hasSpeechCtor: true,
});
assert(httpLan.canListen === false && httpLan.insecure === true && httpLan.preferType === true, "HTTP LAN cannot use the mic");

console.log("OK route — lang= is TV-only, opt-in, and omitted from the combined TV link");
