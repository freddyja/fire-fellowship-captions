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
      locale = next;
      if (rec) rec.lang = next;
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
      rec.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const chunk = event.results[i];
          const text = chunk[0].transcript.trim();
          if (!text) continue;
          if (chunk.isFinal) provider.onResult?.({ text, isFinal: true });
          else interim += `${text} `;
        }
        const live = interim.trim();
        if (live) provider.onResult?.({ text: live, isFinal: false });
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
