import type { Lang } from "../types";
import { PHRASES, WORDS, type Triple } from "./mock-dict.ts";
import type { Translator } from "./types";

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preserveCase(source: string, translated: string): string {
  if (source === source.toUpperCase() && source.length > 1) return translated.toUpperCase();
  if (source[0] && source[0] === source[0].toUpperCase()) {
    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }
  return translated;
}

type PhraseEntry = { pattern: string; to: string; len: number };

function phraseEntries(from: Lang, to: Lang, triples: Triple[]): PhraseEntry[] {
  return triples
    .map((row) => ({ pattern: row[from], to: row[to], len: row[from].length }))
    .filter((row) => row.pattern && row.to)
    .sort((a, b) => b.len - a.len);
}

const PHRASE_INDEX: Record<string, PhraseEntry[]> = {};
const WORD_INDEX: Record<string, Map<string, string>> = {};

for (const from of ["en", "es", "pt"] as Lang[]) {
  for (const to of ["en", "es", "pt"] as Lang[]) {
    if (from === to) continue;
    const key = `${from}:${to}`;
    PHRASE_INDEX[key] = phraseEntries(from, to, PHRASES);
    const words = new Map<string, string>();
    for (const row of WORDS) {
      words.set(fold(row[from]), row[to]);
    }
    WORD_INDEX[key] = words;
  }
}

export const mockTranslator: Translator = {
  id: "mock",
  async translate(text, from, to) {
    if (from === to || !text.trim()) return text;
    const key = `${from}:${to}`;
    let output = text;

    for (const phrase of PHRASE_INDEX[key] ?? []) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase.pattern)}(?![\\p{L}\\p{N}])`, "giu");
      output = output.replace(re, (match) => preserveCase(match, phrase.to));
    }

    output = output.replace(/[\p{L}]+(?:['’][\p{L}]+)?/gu, (word) => {
      const mapped = WORD_INDEX[key]?.get(fold(word));
      return mapped ? preserveCase(word, mapped) : word;
    });

    return output;
  },
};
