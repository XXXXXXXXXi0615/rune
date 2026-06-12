import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './styles/chat.css'
import './styles/memory.css'
import './styles/calendar.css';
import './styles/music.css';
import './styles/settings.css';
import './styles/home.css';
import './styles/moonread.css';
import './styles/desktop.css';
import App from './App';
import { runAssetMigration } from './store/migration';

const DEV_SW_CLEANUP_KEY = 'lunartide-dev-sw-cleaned';

async function clearDevelopmentCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

async function configureServiceWorker() {
  if (import.meta.env.PROD) {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[lunartide] Service Worker registration failed', error);
      });
    });
    return;
  }

  if (!import.meta.env.DEV) return;

  if (!('serviceWorker' in navigator)) {
    await clearDevelopmentCaches();
    return;
  }

  const wasControlled = navigator.serviceWorker.controller !== null;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  await clearDevelopmentCaches();

  if (wasControlled && sessionStorage.getItem(DEV_SW_CLEANUP_KEY) !== 'true') {
    sessionStorage.setItem(DEV_SW_CLEANUP_KEY, 'true');
    window.location.reload();
    return;
  }

  sessionStorage.removeItem(DEV_SW_CLEANUP_KEY);
}

void configureServiceWorker().catch((error) => {
  console.warn('[lunartide] Service Worker cleanup failed', error);
});

runAssetMigration().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
