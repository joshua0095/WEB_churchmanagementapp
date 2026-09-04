/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The app's version, from package.json — injected at build time (see vite.config.ts). */
declare const __APP_VERSION__: string;
