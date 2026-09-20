export type SpeechResult = {
  text: string;
  isFinal: boolean;
};

export type SpeechProvider = {
  readonly supported: boolean;
  start(): void;
  stop(): void;
  setLang(locale: string): void;
  onResult: ((result: SpeechResult) => void) | null;
  onError: ((message: string) => void) | null;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function createWebSpeechProvider(): SpeechProvider {
  const Ctor = getRecognitionCtor();
  let rec: SpeechRecognitionLike | null = null;
  let locale = "en-US";
  let wantListening = false;

  const provider: SpeechProvider = {
    supported: Boolean(Ctor),
    onResult: null,
    onError: null,
    setLang(next) {
      const localeNext = next.trim() || locale;
      if (localeNext === locale) {
        if (rec) rec.lang = localeNext;
        return;
      }
      locale = localeNext;
      // Chrome ignores mid-session lang changes; rebuild the recognizer.
      if (wantListening) {
        provider.start();
        return;
      }
      if (rec) rec.lang = localeNext;
    },
    start() {
      if (!Ctor) {
        provider.onError?.("This browser has no Web Speech API. Use Chrome on the phone.");
        return;
      }
      wantListening = true;
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* already stopped */
        }
      }
      rec = new Ctor();
      rec.lang = locale;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      const emittedFinals = new Set<number>();
      rec.onresult = (event) => {
        let interim = "";
        // Walk the whole list: Chrome on Android often reports resultIndex 0
        // on every event and would re-emit earlier finals as new history lines.
        for (let i = 0; i < event.results.length; i += 1) {
          const chunk = event.results[i];
          const text = chunk[0].transcript.trim();
          if (!text) continue;
          if (chunk.isFinal) {
            if (!emittedFinals.has(i)) {
              emittedFinals.add(i);
              provider.onResult?.({ text, isFinal: true });
            }
          } else {
            interim += `${text} `;
          }
        }
        provider.onResult?.({ text: interim.trim(), isFinal: false });
      };
      rec.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted" || event.error === "network") return;
        if (event.error === "not-allowed") {
          provider.onError?.("Microphone blocked. Allow mic access for this site.");
          wantListening = false;
          return;
        }
        provider.onError?.(event.error);
      };
      rec.onend = () => {
        emittedFinals.clear();
        if (wantListening) {
          window.setTimeout(() => {
            if (!wantListening) return;
            try {
              rec?.start();
            } catch {
              /* Chrome throws if start() overlaps */
            }
          }, 120);
        }
      };
      try {
        rec.start();
      } catch (err) {
        provider.onError?.(err instanceof Error ? err.message : "Could not start the microphone.");
      }
    },
    stop() {
      wantListening = false;
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
      rec = null;
    },
  };

  return provider;
}
