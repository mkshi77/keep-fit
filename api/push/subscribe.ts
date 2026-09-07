import { savePushSubscription, removePushSubscription, getVapidConfig } from '../../server/pushStore.js';
import { authFailure } from '../../server/auth.js';
import { isAllowedBrowserOrigin, type ApiRequest, type ApiResponse } from '../../server/http.js';

interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  remindTime: string;
}

const validateSubscription = (body: unknown): PushSubscriptionJSON | null => {
  if (!body || typeof body !== 'object') return null;
  const candidate = body as Partial<PushSubscriptionJSON>;
  if (!candidate.endpoint || typeof candidate.endpoint !== 'string' || !candidate.endpoint.startsWith('https://')) return null;
  if (!candidate.keys || typeof candidate.keys !== 'object') return null;
  if (typeof candidate.keys.p256dh !== 'string' || typeof candidate.keys.auth !== 'string') return null;
  if (!candidate.remindTime || !/^\d{2}:\d{2}$/.test(candidate.remindTime)) return null;
  return candidate as PushSubscriptionJSON;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (!isAllowedBrowserOrigin(request)) return response.status(403).json({ error: '不允许的请求来源' });
  const failure = authFailure(request);
  if (failure) return response.status(failure.status).json(failure);

  if (request.method === 'POST') {
    if (!getVapidConfig()) return response.status(503).json({ error: 'VAPID keys 未配置，推送不可用' });
    const sub = validateSubscription(request.body);
    if (!sub) return response.status(400).json({ error: '推送订阅数据无效' });
    savePushSubscription(sub.endpoint, sub as unknown as Parameters<typeof savePushSubscription>[1], sub.remindTime);
    return response.status(200).json({ success: true });
  }

  if (request.method === 'DELETE') {
    const body = (request.body ?? {}) as { endpoint?: string };
    if (body.endpoint) removePushSubscription(body.endpoint);
    return response.status(200).json({ success: true });
  }

  response.setHeader('Allow', 'POST, DELETE');
  return response.status(405).json({ error: 'Method not allowed' });
}
