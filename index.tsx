import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { applyTheme, getStoredTheme } from './utils/theme';

applyTheme(getStoredTheme());

// Offline app shell (production only; dev uses Vite's live server). The entry chunk's hashed path versions it per deploy.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(new URL(import.meta.url).pathname)}`);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);