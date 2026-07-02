import { apiClient } from './apiClient';

/** Convert a base64url VAPID key into the Uint8Array PushManager expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

const supported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * Resolve the service worker registration, registering sw.js on demand.
 * main.tsx only registers it in production builds, so waiting on
 * `navigator.serviceWorker.ready` would hang forever in dev.
 */
async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export const pushService = {
  isSupported: supported,

  /** Whether this browser currently holds an active push subscription. */
  async isSubscribed(): Promise<boolean> {
    if (!supported()) return false;
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    return (await registration.pushManager.getSubscription()) !== null;
  },

  /**
   * Ask for notification permission, create the browser subscription, and
   * register it with the server. Returns false when push is unavailable,
   * permission is denied, or the server has no VAPID keys configured.
   */
  async subscribe(): Promise<boolean> {
    if (!supported()) return false;

    const keyRes = await apiClient.get<{ data: string }>('/api/notifications/push/public-key');
    const publicKey = keyRes.data.data;
    if (!publicKey) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await ensureRegistration();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    });

    const json = subscription.toJSON();
    await apiClient.post('/api/notifications/push/subscribe', {
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    });
    return true;
  },

  /** Drop the browser subscription and tell the server to forget it. */
  async unsubscribe(): Promise<void> {
    if (!supported()) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration && (await registration.pushManager.getSubscription());
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await apiClient.post('/api/notifications/push/unsubscribe', { endpoint }).catch(() => undefined);
  },
};
