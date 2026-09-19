import { mockTranslator } from "../src/translate/mock.ts";
import type { Lang } from "../src/types.ts";

export type TranslateProvider = "google" | "mock";

const LANGS: Lang[] = ["en", "es", "pt"];
const MAX_TEXT = 2000;
const GOOGLE_URL = "https://translation.googleapis.com/language/translate/v2";
const cache = new Map<string, string>();
const CACHE_LIMIT = 400;

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "es" || value === "pt";
}

export function resolveTranslateProvider(): TranslateProvider {
  const requested = String(process.env.TRANSLATE_PROVIDER || "").trim().toLowerCase();
  const key = googleKey();
  if ((requested === "google" || requested === "google-cloud") && key) return "google";
  return "mock";
}

export function googleKey(): string {
  return String(process.env.GOOGLE_TRANSLATE_API_KEY || "").trim();
}

export function emptyLocalized(source: string, from: Lang): Record<Lang, string> {
  return {
    en: from === "en" ? source : "",
    es: from === "es" ? source : "",
    pt: from === "pt" ? source : "",
  };
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

  if (provider === "google") {
    try {
      await Promise.all(
        unique.map(async (to) => {
          out[to] = await googleTranslate(source, from, to);
        }),
      );
      return { provider: "google", text: out };
    } catch (err) {
      console.warn("[translate] Google Cloud Translation failed; using mock");
      console.warn(err instanceof Error ? err.message : "translate error");
    }
  }

  await Promise.all(
    unique.map(async (to) => {
      out[to] = await mockTranslator.translate(source, from, to);
    }),
  );
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

async function googleTranslate(text: string, from: Lang, to: Lang): Promise<string> {
  const key = googleKey();
  if (!key) throw new Error("GOOGLE_TRANSLATE_API_KEY is not set");
  const cacheKey = `${from}:${to}:${text}`;
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
  const requested = String(process.env.TRANSLATE_PROVIDER || "").trim().toLowerCase();
  if ((requested === "google" || requested === "google-cloud") && !googleKey()) {
    console.warn("[translate] TRANSLATE_PROVIDER=google but GOOGLE_TRANSLATE_API_KEY is empty; using mock");
  }
}
