import { mockTranslator } from "./mock";
import { createLibreTranslator } from "./libretranslate";
import { createMyMemoryTranslator } from "./mymemory";
import { passthroughTranslator } from "./passthrough";
import { createServerTranslator } from "./server";
import type { Translator } from "./types";

export type { Translator } from "./types";
export { translateAll } from "./types";

export function createTranslator(): Translator {
  const provider = String(import.meta.env.VITE_TRANSLATE_PROVIDER || "").toLowerCase();

  if (provider === "passthrough") return passthroughTranslator;
  if (provider === "mymemory") {
    const email = String(import.meta.env.VITE_MYMEMORY_EMAIL || "").trim() || undefined;
    return withFallback(createMyMemoryTranslator({ email }));
  }
  if (provider === "libretranslate") return withFallback(createLibreTranslator());
  if (provider === "mock") return mockTranslator;
  return withFallback(createServerTranslator());
}

function withFallback(primary: Translator): Translator {
  return {
    id: primary.id,
    async translate(text, from, to) {
      try {
        return await primary.translate(text, from, to);
      } catch (err) {
        console.warn(`[translate] ${primary.id} failed, using mock`, err);
        return mockTranslator.translate(text, from, to);
      }
    },
    async translateAll(text, from) {
      try {
        if (primary.translateAll) return await primary.translateAll(text, from);
      } catch (err) {
        console.warn(`[translate] ${primary.id} failed, using mock`, err);
      }
      return {
        en: from === "en" ? text : await safeMock(text, from, "en"),
        es: from === "es" ? text : await safeMock(text, from, "es"),
        pt: from === "pt" ? text : await safeMock(text, from, "pt"),
      };
    },
  };
}

async function safeMock(text: string, from: import("../types").Lang, to: import("../types").Lang): Promise<string> {
  try {
    return await mockTranslator.translate(text, from, to);
  } catch {
    return text;
  }
}
