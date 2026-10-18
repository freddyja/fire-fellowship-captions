import { LANGS, MAX_LINES, type CaptionLine, type Lang } from "./types";

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
    const { pending: _pending, ...rest } = line;
    return { ...rest, text: { ...text, [sourceLang]: line.text[sourceLang] } };
  });
  return changed ? next : lines;
}

/**
 * Translation failed or timed out: show the original words in the empty panes
 * (better than an endless "translating…") and clear the pending flag.
 */
export function settleUntranslated(lines: CaptionLine[], id: string, sourceLang: Lang): CaptionLine[] {
  let changed = false;
  const next = lines.map((line) => {
    if (line.id !== id || !line.pending) return line;
    changed = true;
    const spoken = line.text[sourceLang] ?? "";
    const text = { ...line.text };
    for (const lang of LANGS) if (!text[lang]?.trim()) text[lang] = spoken;
    const { pending: _pending, ...rest } = line;
    return { ...rest, text };
  });
  return changed ? next : lines;
}

/**
 * Words for a line that was just heard or typed. Only the spoken language has
 * them; the other panes stay empty (shown as "translating…") until the
 * translation lands, instead of flashing the untranslated original.
 */
export function provisionalText(spoken: string, sourceLang: Lang): Record<Lang, string> {
  return { en: "", es: "", pt: "", [sourceLang]: spoken } as Record<Lang, string>;
}
