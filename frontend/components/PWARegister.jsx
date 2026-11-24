'use client';

import { useEffect } from 'react';

// No service worker is registered any more (the old one served stale pages
// after deploys). This component removes any worker + caches left over from
// earlier versions. The web-app manifest still lets people "Add to Home Screen".
export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if ('caches' in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
  }, []);
  return null;
}
