import { MAX_LINES, type CaptionLine, type Lang } from "./types";

export const INTERIM_ID = "interim";

export function finalizedLines(lines: CaptionLine[]): CaptionLine[] {
  return lines.filter((line) => line.isFinal && line.id !== INTERIM_ID);
}

/** Prefer the spoken language, then any pane that actually has words. */
export function previewCaption(line: CaptionLine | undefined, preferred: Lang): string {
  if (!line) return "";
  const ordered: Lang[] = [preferred, "en", "es", "pt"];
  for (const lang of ordered) {
    const text = line.text[lang]?.trim();
    if (text) return text;
  }
  return "";
}

export function normalizeCaption(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.?!…,;:]+$/u, "");
}

export function revisionOfLast(
  prevText: string | undefined,
  nextText: string,
): "duplicate" | "replace" | "append" {
  if (!prevText) return "append";
  const prev = normalizeCaption(prevText);
  const next = normalizeCaption(nextText);
  if (!prev || !next) return "append";
  if (prev === next) return "duplicate";
  if (next.startsWith(prev)) return "replace";
  if (prev.startsWith(next)) return "duplicate";
  return "append";
}

export function applyFinalLine(
  lines: CaptionLine[],
  line: CaptionLine,
  sourceLang: Lang,
  maxLines = MAX_LINES,
): CaptionLine[] {
  const history = finalizedLines(lines);
  const last = history.at(-1);
  const verdict = revisionOfLast(last?.text[sourceLang], line.text[sourceLang]);
  if (verdict === "duplicate") return history;
  if (verdict === "replace" && last) {
    return [...history.slice(0, -1), { ...line, id: last.id }].slice(-maxLines);
  }
  return [...history, line].slice(-maxLines);
}

export function appendFinalLine(
  lines: CaptionLine[],
  line: CaptionLine,
  maxLines = MAX_LINES,
): CaptionLine[] {
  return [...finalizedLines(lines), line].slice(-maxLines);
}

/** Fill in translations for a line that was shown with its original words first. */
export function patchLineText(
  lines: CaptionLine[],
  id: string,
  text: Record<Lang, string>,
  sourceLang: Lang,
): CaptionLine[] {
  let changed = false;
  const next = lines.map((line) => {
    if (line.id !== id) return line;
    changed = true;
    // Keep the source words as shown; a coalesced revision may have replaced them.
    return { ...line, text: { ...text, [sourceLang]: line.text[sourceLang] } };
  });
  return changed ? next : lines;
}

/** Original words in every pane until translations arrive. */
export function provisionalText(spoken: string): Record<Lang, string> {
  return { en: spoken, es: spoken, pt: spoken };
}
