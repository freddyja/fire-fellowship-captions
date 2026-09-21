import { parseRoute, parseTvLang, tvSearch } from "../src/router.ts";

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
  { view: "phone", room: "ABCD" },
  "lang= on phone is ignored",
);
same(parseRoute("?lang=es"), { view: "home", room: "" }, "lang= without TV view is ignored");

assert(tvSearch("ABCD") === "view=tv&room=ABCD", "combined TV query has no lang");
assert(tvSearch("ABCD", "es") === "view=tv&room=ABCD&lang=es", "per-language TV query");
assert(tvSearch("ABCD", "en") === "view=tv&room=ABCD&lang=en", "en TV query");
assert(tvSearch("ABCD", "pt") === "view=tv&room=ABCD&lang=pt", "pt TV query");

console.log("OK route — lang= is TV-only, opt-in, and omitted from the combined TV link");
