import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import './pwa/installPrompt';
import App from './App.tsx';
import { AuthSessionProvider } from './providers/AuthSessionProvider';
import './index.css';

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('PWA service worker registration failed:', error);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthSessionProvider>
      <App />
    </AuthSessionProvider>
  </StrictMode>,
);
