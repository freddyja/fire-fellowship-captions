export type Lang = "en" | "es" | "pt";
export type Role = "phone" | "tv";
export type Layout = "en" | "es" | "pt" | "en-es" | "en-pt" | "es-pt" | "en-es-pt";
export type ConnStatus = "connecting" | "live" | "offline";
export type Localized = Record<Lang, string>;

export type TopicContent = {
  id: string;
  title: Localized;
  reference: string;
  verse: Localized;
  hook: Localized;
  body: Localized;
  discussionQuestions: Localized[];
  /** Short prompt kept so older room state and custom topics still render. */
  prompt: Localized;
};

export type CaptionLine = {
  id: string;
  isFinal: boolean;
  text: Record<Lang, string>;
  at: number;
};

export type RoomState = {
  room: string;
  layout: Layout;
  sourceLang: Lang;
  listening: boolean;
  lines: CaptionLine[];
  topic: TopicContent | null;
};

export type PeerCounts = {
  phones: number;
  tvs: number;
};

export const LANGS: Lang[] = ["en", "es", "pt"];

/** Topic / talk sheet is always three columns, independent of caption layout. */
export const TOPIC_SHEET_LANGS: Lang[] = ["en", "es", "pt"];

export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

export const LANG_SHORT: Record<Lang, string> = {
  en: "EN",
  es: "ES",
  pt: "PT",
};

export const LAYOUTS: { id: Layout; label: string; langs: Lang[] }[] = [
  { id: "en", label: "English", langs: ["en"] },
  { id: "es", label: "Español", langs: ["es"] },
  { id: "pt", label: "Português", langs: ["pt"] },
  { id: "en-es", label: "EN | ES", langs: ["en", "es"] },
  { id: "en-pt", label: "EN | PT", langs: ["en", "pt"] },
  { id: "es-pt", label: "ES | PT", langs: ["es", "pt"] },
  { id: "en-es-pt", label: "EN | ES | PT", langs: ["en", "es", "pt"] },
];

export const MAX_LINES = 8;

export function langsForLayout(layout: Layout): Lang[] {
  return LAYOUTS.find((item) => item.id === layout)?.langs ?? ["en", "es", "pt"];
}

export function emptyState(room: string): RoomState {
  return {
    room,
    layout: "en-es-pt",
    sourceLang: "en",
    listening: false,
    lines: [],
    topic: null,
  };
}

export function speechLocale(lang: Lang): string {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
}
