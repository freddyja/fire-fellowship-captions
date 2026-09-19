/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRANSLATE_PROVIDER?: string;
  readonly VITE_LIBRETRANSLATE_URL?: string;
  readonly VITE_LIBRETRANSLATE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
