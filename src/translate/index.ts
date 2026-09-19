import { mockTranslator } from "./mock";
import { createLibreTranslator } from "./libretranslate";
import { createMyMemoryTranslator } from "./mymemory";
import { passthroughTranslator } from "./passthrough";
import type { Translator } from "./types";

export type { Translator } from "./types";
export { translateAll } from "./types";

export function createTranslator(): Translator {
  const provider = String(import.meta.env.VITE_TRANSLATE_PROVIDER || "mock").toLowerCase();

  if (provider === "passthrough") return passthroughTranslator;
  if (provider === "mymemory") return withFallback(createMyMemoryTranslator());
  if (provider === "libretranslate") return withFallback(createLibreTranslator());
  return mockTranslator;
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
  };
}
