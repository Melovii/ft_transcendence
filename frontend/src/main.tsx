import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@app/App';
import '@shared/styles/index.css';
import '@shared/i18n/i18n';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html.');

function render(root: HTMLElement): void {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Development-only mock layers. Each dynamic import sits behind a build-time constant,
// so production bundles never include them. REST and sockets switch independently.
async function installDevMocks(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_MOCK_API === 'true') {
    const { installMockApi } = await import('@shared/api/mock');
    installMockApi();
  }
  if (import.meta.env.VITE_MOCK_SOCKETS === 'true') {
    const { installMockSockets } = await import('@shared/websocket/mock');
    installMockSockets();
  }
}

void installDevMocks().finally(() => render(container));
