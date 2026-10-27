import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { App } from './ui/App';
import { initStore } from './ui/store';

registerSW({ immediate: true });
// Ask the browser not to evict our IndexedDB data.
void navigator.storage?.persist?.();
void initStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
