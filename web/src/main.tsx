import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handling for fetch and other network errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message === 'Failed to fetch') {
    console.error('Global Fetch Error:', event.reason);
    // You could trigger a toast notification here if you had a toast system
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
