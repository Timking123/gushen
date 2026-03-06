/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_ENABLE_AI_ASSISTANT: string
  readonly VITE_ENABLE_PUSH_NOTIFICATIONS: string
  readonly VITE_MARKET_DATA_API_KEY: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
