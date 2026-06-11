/** Register the PWA service worker (production only — avoids dev cache surprises). */
export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline shell is best-effort */
      });
    });
  }
}
