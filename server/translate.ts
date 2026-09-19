import { deeplTranslate } from "../src/translate/deepl.ts";
import { mockTranslator } from "../src/translate/mock.ts";
import { createMyMemoryTranslator } from "../src/translate/mymemory.ts";
import type { Translator } from "../src/translate/types.ts";
import type { Lang } from "../src/types.ts";

export type TranslateProvider = "deepl" | "google" | "mymemory" | "mock";

const LANGS: Lang[] = ["en", "es", "pt"];
const MAX_TEXT = 2000;
const GOOGLE_URL = "https://translation.googleapis.com/language/translate/v2";
const cache = new Map<string, string>();
const CACHE_LIMIT = 400;

let myMemory: Translator | null = null;
let myMemoryEmail: string | undefined;

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "es" || value === "pt";
}

function requestedProvider(): string {
  return String(process.env.TRANSLATE_PROVIDER || "").trim().toLowerCase();
}

export function googleKey(): string {
  return String(process.env.GOOGLE_TRANSLATE_API_KEY || "").trim();
}

export function deeplKey(): string {
  return String(process.env.DEEPL_AUTH_KEY || "").trim();
}

function deeplApiUrlOverride(): string {
  return String(process.env.DEEPL_API_URL || "").trim();
}

function myMemoryEmailFromEnv(): string | undefined {
  return String(process.env.MYMEMORY_EMAIL || "").trim() || undefined;
}

/**
 * Recommended meeting-night provider is DeepL Free when DEEPL_AUTH_KEY is set.
 * If that key is missing, MyMemory (no key) keeps hosted demos working.
 * Mock is opt-in for offline. Google only when a Cloud key is present.
 */
export function resolveTranslateProvider(): TranslateProvider {
  const requested = requestedProvider();
  if (requested === "mock") return "mock";
  if (requested === "mymemory") return "mymemory";
  if ((requested === "google" || requested === "google-cloud") && googleKey()) return "google";
  if ((requested === "deepl" || requested === "") && deeplKey()) return "deepl";
  return "mymemory";
}

function getMyMemoryTranslator(): Translator {
  const email = myMemoryEmailFromEnv();
  if (!myMemory || myMemoryEmail !== email) {
    myMemory = createMyMemoryTranslator({ email });
    myMemoryEmail = email;
  }
  return myMemory;
}

export function emptyLocalized(source: string, from: Lang): Record<Lang, string> {
  return {
    en: from === "en" ? source : "",
    es: from === "es" ? source : "",
    pt: from === "pt" ? source : "",
  };
}

async function fillTargets(
  translator: { translate(text: string, from: Lang, to: Lang): Promise<string> },
  source: string,
  from: Lang,
  targets: Lang[],
  out: Record<Lang, string>,
): Promise<void> {
  await Promise.all(
    targets.map(async (to) => {
      out[to] = await translator.translate(source, from, to);
    }),
  );
}

export async function translateCaption(
  text: string,
  from: Lang,
  targets: Lang[] = LANGS,
): Promise<{ provider: TranslateProvider; text: Record<Lang, string> }> {
  const source = text.trim();
  if (!source) {
    return { provider: resolveTranslateProvider(), text: emptyLocalized("", from) };
  }
  if (source.length > MAX_TEXT) {
    throw Object.assign(new Error("Text is too long"), { status: 400 });
  }

  const unique = [...new Set(targets.filter((lang) => lang !== from))];
  const out = emptyLocalized(source, from);
  const provider = resolveTranslateProvider();

  if (provider === "deepl") {
    try {
      await Promise.all(
        unique.map(async (to) => {
          out[to] = await cachedDeepL(source, from, to);
        }),
      );
      return { provider: "deepl", text: out };
    } catch (err) {
      console.warn("[translate] DeepL failed; trying MyMemory");
      console.warn(err instanceof Error ? err.message : "translate error");
    }
  }

  if (provider === "google") {
    try {
      await Promise.all(
        unique.map(async (to) => {
          out[to] = await googleTranslate(source, from, to);
        }),
      );
      return { provider: "google", text: out };
    } catch (err) {
      console.warn("[translate] Google Cloud Translation failed; trying MyMemory");
      console.warn(err instanceof Error ? err.message : "translate error");
    }
  }

  if (provider !== "mock") {
    try {
      await fillTargets(getMyMemoryTranslator(), source, from, unique, out);
      return { provider: "mymemory", text: out };
    } catch (err) {
      console.warn("[translate] MyMemory failed; using mock");
      console.warn(err instanceof Error ? err.message : "translate error");
    }
  }

  await fillTargets(mockTranslator, source, from, unique, out);
  return { provider: "mock", text: out };
}

function cacheGet(key: string): string | undefined {
  return cache.get(key);
}

function cacheSet(key: string, value: string): void {
  if (cache.size >= CACHE_LIMIT) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, value);
}

async function cachedDeepL(text: string, from: Lang, to: Lang): Promise<string> {
  const cacheKey = `deepl:${from}:${to}:${text}`;
  const hit = cacheGet(cacheKey);
  if (hit !== undefined) return hit;
  const translated = await deeplTranslate(text, from, to, {
    authKey: deeplKey(),
    apiUrl: deeplApiUrlOverride(),
  });
  cacheSet(cacheKey, translated);
  return translated;
}

async function googleTranslate(text: string, from: Lang, to: Lang): Promise<string> {
  const key = googleKey();
  if (!key) throw new Error("GOOGLE_TRANSLATE_API_KEY is not set");
  const cacheKey = `google:${from}:${to}:${text}`;
  const hit = cacheGet(cacheKey);
  if (hit !== undefined) return hit;

  const url = new URL(GOOGLE_URL);
  url.searchParams.set("key", key);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: text, source: from, target: to, format: "text" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Google Translate HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    data?: { translations?: { translatedText?: string }[] };
  };
  const translated = data.data?.translations?.[0]?.translatedText?.trim();
  if (!translated) throw new Error("Google Translate returned no text");
  cacheSet(cacheKey, translated);
  return translated;
}

export function warnIfGoogleRequestedWithoutKey(): void {
  const requested = requestedProvider();
  if (requested === "deepl" && !deeplKey()) {
    console.warn(
      "[translate] TRANSLATE_PROVIDER=deepl but DEEPL_AUTH_KEY is empty; using MyMemory (no key). Set TRANSLATE_PROVIDER=mock for offline.",
    );
  }
  if ((requested === "google" || requested === "google-cloud") && !googleKey()) {
    console.warn(
      "[translate] TRANSLATE_PROVIDER=google but GOOGLE_TRANSLATE_API_KEY is empty; using MyMemory (no key). Set TRANSLATE_PROVIDER=mock for offline.",
    );
  }
}
