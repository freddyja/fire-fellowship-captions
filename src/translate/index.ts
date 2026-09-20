import { isOfflineMeeting } from "../offline-mode";
import { detectLang } from "./detect";
import { mockTranslator } from "./mock";
import { createLibreTranslator } from "./libretranslate";
import { createMyMemoryTranslator } from "./mymemory";
import { passthroughTranslator } from "./passthrough";
import { createServerTranslator } from "./server";
import { translateAll as runTranslateAll, type Translator } from "./types";

export type { Translator } from "./types";
export { detectLang } from "./detect";
export { translateAll } from "./types";

export function createTranslator(): Translator {
  const provider = String(import.meta.env.VITE_TRANSLATE_PROVIDER || "").toLowerCase();
  const primary = translatorForProvider(provider);
  return withOfflineMode(primary);
}

function translatorForProvider(provider: string): Translator {
  if (provider === "passthrough") return passthroughTranslator;
  if (provider === "mymemory") {
    const email = String(import.meta.env.VITE_MYMEMORY_EMAIL || "").trim() || undefined;
    return withFallback(createMyMemoryTranslator({ email }));
  }
  if (provider === "libretranslate") return withFallback(createLibreTranslator());
  if (provider === "mock") return mockTranslator;
  return withFallback(createServerTranslator());
}

function withOfflineMode(primary: Translator): Translator {
  const active = () => (isOfflineMeeting() ? mockTranslator : primary);
  return {
    get id() {
      return active().id;
    },
    translate(text, from, to) {
      return active().translate(text, from, to);
    },
    translateAll(text, from) {
      return runTranslateAll(active(), text, detectLang(text, from));
    },
  };
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
