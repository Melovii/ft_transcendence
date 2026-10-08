/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_PATH?: string;
  readonly VITE_WS_BASE_PATH?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  /** `true` swaps both sockets for the in-memory mock in `npm run dev` only. */
  readonly VITE_MOCK_SOCKETS?: string;
  /** Scenario a mock room socket starts in; see `shared/websocket/mock/scenarios.ts`. */
  readonly VITE_MOCK_ROOM_SCENARIO?: string;
  /** `true` answers every REST call from the in-memory mock in `npm run dev` only. */
  readonly VITE_MOCK_API?: string;
  /** Session the mock REST API starts with: `logged-in` (default), `logged-out`, `in-room` or `session-expired`. */
  readonly VITE_MOCK_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
