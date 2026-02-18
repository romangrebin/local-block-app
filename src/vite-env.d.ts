/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string;
  readonly VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
  readonly VITE_FIREBASE_AUTH_ACTION_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
