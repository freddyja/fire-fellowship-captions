import type { Lang } from "../types";
import type { Translator } from "./types";

function pair(from: Lang, to: Lang): string {
  return `${from}|${to}`;
}

export function createMyMemoryTranslator(): Translator {
  const cache = new Map<string, string>();

  return {
    id: "mymemory",
    async translate(text, from, to) {
      if (from === to || !text.trim()) return text;
      const key = `${pair(from, to)}:${text}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;

      const url = new URL("https://api.mymemory.translated.net/get");
      url.searchParams.set("q", text.slice(0, 500));
      url.searchParams.set("langpair", pair(from, to));

      const res = await fetch(url);
      if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
      const data = (await res.json()) as { responseData?: { translatedText?: string } };
      const translated = data.responseData?.translatedText?.trim() || text;
      cache.set(key, translated);
      return translated;
    },
  };
}
