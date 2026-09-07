import webpush from 'web-push';
import type { PushSubscription as WebPushSubscription } from 'web-push';

export interface PushSubscriptionRecord {
  subscription: WebPushSubscription;
  remindTime: string;
  createdAt: number;
}

const store = new Map<string, PushSubscriptionRecord>();

export const getVapidConfig = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@keepfit.app';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
};

export const savePushSubscription = (
  endpoint: string,
  subscription: WebPushSubscription,
  remindTime: string,
) => {
  store.set(endpoint, { subscription, remindTime, createdAt: Date.now() });
};

export const removePushSubscription = (endpoint: string) => {
  store.delete(endpoint);
};

export const getDuePushSubscriptions = (currentTime: string) => {
  const due: PushSubscriptionRecord[] = [];
  for (const record of store.values()) {
    if (record.remindTime === currentTime) due.push(record);
  }
  return due;
};

export const sendPushNotification = async (
  subscription: WebPushSubscription,
  payload: { title: string; body: string },
) => {
  const config = getVapidConfig();
  if (!config) throw new Error('VAPID keys 未配置，无法发送推送');
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  await webpush.sendNotification(subscription, JSON.stringify(payload));
};
