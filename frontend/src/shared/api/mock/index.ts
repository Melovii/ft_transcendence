/**
 * Mock REST layer for development.
 *
 * `installMockApi()` swaps the REST client's transport so every `apiRequest` is
 * answered by an in-memory server instead of the Gateway. Nothing above the transport
 * changes: the same bindings, envelopes, `ApiError` normalization and silent refresh
 * run either way, so no component knows which one is active.
 *
 * It is loaded only through a dynamic import guarded by `import.meta.env.DEV` and
 * `VITE_MOCK_API=true` (see `main.tsx`), so a production build never contains it.
 *
 * Control it from the browser console:
 *
 *   mockApi.config.latencyMs = 1000
 *   mockApi.config.outcomes.joinRoom = 'conflict'    // see `MockOutcome`
 *   mockApi.config.auth = 'logged-out'; mockApi.reset()
 *   mockApi.server.expireAccess()                   // next 401 refreshes silently
 *   mockApi.server.revokeSession()                  // refresh fails too: back to Log In
 */

import { mockNetwork } from '@shared/websocket/mock';

import { setRequestTransport } from '../client';
import type { RequestTransport } from '../client';
import { defaultMockApiConfig } from './config';
import type { MockApiConfig } from './config';
import { MOCK_PASSWORD } from './fixtures';
import { MockApiServer } from './mockApiServer';

export type { MockApiConfig, MockAuthState, MockEndpoint, MockOutcome } from './config';
export { MOCK_PASSWORD } from './fixtures';
export { MockApiServer } from './mockApiServer';

export interface MockApi {
  /** Mutable at runtime; read on every request. */
  readonly config: MockApiConfig;
  readonly server: MockApiServer;
  /** Restore the seed data and re-apply `config.auth`. Reload the page to see it. */
  reset(): void;
  /** Restore the browser `fetch` transport. */
  uninstall(): void;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

export function installMockApi(config: MockApiConfig = defaultMockApiConfig()): MockApi {
  const server = new MockApiServer(config);

  const transport: RequestTransport = async (path, options) => {
    await delay(config.latencyMs);
    if (options.signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
    // `mockSockets.offline()` takes REST down with the sockets.
    if (!mockNetwork.online) throw new TypeError('Failed to fetch (mock network offline)');
    const response = server.handle(path, options);
    if (config.latencyMs > 0) {
      console.debug(`[mock api] ${options.method ?? 'GET'} ${path} -> ${response.status}`);
    }
    return response;
  };

  setRequestTransport(transport);

  const api: MockApi = {
    config,
    server,
    reset: () => server.reset(),
    uninstall() {
      setRequestTransport(null);
      delete (globalThis as { mockApi?: MockApi }).mockApi;
    },
  };

  (globalThis as { mockApi?: MockApi }).mockApi = api;
  console.info(
    `[mock api] installed (auth: ${config.auth}, latency: ${config.latencyMs}ms) — control it with \`mockApi\` in the console. Seeded accounts use the password '${MOCK_PASSWORD}'.`,
  );
  return api;
}
