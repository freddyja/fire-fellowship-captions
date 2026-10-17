import { isOfflineMeeting } from "../offline-mode";
import { isLang, type Lang } from "../types";
import type { Translator } from "./types";

type TranslateResponse = {
  provider?: string;
  from?: Lang;
  text?: string | Record<Lang, string>;
};

/** Client wait for one caption's translations before giving up on them. */
export const TRANSLATE_TIMEOUT_MS = 5000;

export function serverAnswered(err: Error): Error {
  return Object.assign(err, { serverAnswered: true });
}

export function isServerAnswered(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { serverAnswered?: boolean }).serverAnswered);
}

export function createServerTranslator(): Translator {
  let lastProvider = "server";
  return {
    get id() {
      return lastProvider;
    },
    async translate(text, from, to) {
      if (from === to || !text.trim()) return text;
      const result = await postTranslate(text, from, [to]);
      if (result.provider) lastProvider = result.provider;
      const value = result.text;
      if (typeof value === "string") return value;
      if (value && typeof value[to] === "string" && value[to]) return value[to];
      throw serverAnswered(new Error("Translate API returned no text"));
    },
    async translateAll(text, from) {
      if (!text.trim()) return { en: "", es: "", pt: "" };
      const result = await postTranslate(text, from);
      if (result.provider) lastProvider = result.provider;
      const value = result.text;
      if (!value || typeof value === "string") {
        throw serverAnswered(new Error("Translate API returned no map"));
      }
      const sourceLang = isLang(result.from) ? result.from : from;
      return {
        en: value.en || (sourceLang === "en" ? text : ""),
        es: value.es || (sourceLang === "es" ? text : ""),
        pt: value.pt || (sourceLang === "pt" ? text : ""),
      };
    },
  };
}

async function postTranslate(text: string, from: Lang, to?: Lang[]): Promise<TranslateResponse> {
  const payload: Record<string, unknown> = {
    text,
    from,
    to: to ?? (["en", "es", "pt"] as Lang[]),
  };
  if (isOfflineMeeting()) payload.provider = "mock";
  let res: Response;
  try {
    res = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn("[translate] /api/translate did not answer", err);
    throw err;
  }
  // The server answered. Its own chain already tried DeepL → MinT → mock,
  // so the client must not stack a second MinT round-trip on top.
  if (!res.ok) throw serverAnswered(new Error(`Translate HTTP ${res.status}`));
  try {
    return (await res.json()) as TranslateResponse;
  } catch (err) {
    throw serverAnswered(err instanceof Error ? err : new Error("Translate API bad JSON"));
  }
}
