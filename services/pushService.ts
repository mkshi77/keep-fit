const VAPID_PUBLIC_KEY_ENDPOINT = '/api/push/vapid-key';
const SUBSCRIBE_ENDPOINT = '/api/push/subscribe';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
};

export const isPushSupported = () =>
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window;

export const getNotificationPermission = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

export const subscribeToPush = async (remindTime: string) => {
  if (!isPushSupported()) throw new Error('浏览器不支持 Web Push');
  if (Notification.permission === 'denied') throw new Error('通知权限已被拒绝，请在浏览器设置中开启');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('通知权限未授权');

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  const keyResponse = await fetch(VAPID_PUBLIC_KEY_ENDPOINT, { cache: 'no-store' });
  const keyData = await keyResponse.json().catch(() => null) as { publicKey?: string } | null;
  if (!keyData?.publicKey) throw new Error('推送配置不可用');

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
  }

  const response = await fetch(SUBSCRIBE_ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...subscription.toJSON(), remindTime }),
  });
  const data = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
  if (!response.ok || !data?.success) throw new Error(data?.error || '推送订阅失败');
};

export const unsubscribeFromPush = async () => {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await fetch(SUBSCRIBE_ENDPOINT, {
      method: 'DELETE',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }
};
