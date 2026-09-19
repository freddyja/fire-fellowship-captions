import type { Lang } from "../types";
import type { Translator } from "./types";

type TranslateResponse = {
  provider?: string;
  text?: string | Record<Lang, string>;
};

export function createServerTranslator(): Translator {
  return {
    id: "server",
    async translate(text, from, to) {
      if (from === to || !text.trim()) return text;
      const result = await postTranslate(text, from, [to]);
      const value = result.text;
      if (typeof value === "string") return value;
      if (value && typeof value[to] === "string" && value[to]) return value[to];
      throw new Error("Translate API returned no text");
    },
    async translateAll(text, from) {
      if (!text.trim()) return { en: "", es: "", pt: "" };
      const result = await postTranslate(text, from);
      const value = result.text;
      if (!value || typeof value === "string") {
        throw new Error("Translate API returned no map");
      }
      return {
        en: value.en || (from === "en" ? text : ""),
        es: value.es || (from === "es" ? text : ""),
        pt: value.pt || (from === "pt" ? text : ""),
      };
    },
  };
}

async function postTranslate(text: string, from: Lang, to?: Lang[]): Promise<TranslateResponse> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(to ? { text, from, to } : { text, from }),
  });
  if (!res.ok) throw new Error(`Translate HTTP ${res.status}`);
  return (await res.json()) as TranslateResponse;
}
