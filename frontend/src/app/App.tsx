import { AppProviders } from './providers/AppProviders';
import { AppRouter } from './router/AppRouter';

/** Application entry. Composition only — no feature behavior belongs here. */
export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
