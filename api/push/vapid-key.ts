import { getVapidConfig } from '../../server/pushStore.js';
import type { ApiRequest, ApiResponse } from '../../server/http.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const config = getVapidConfig();
  if (!config) return response.status(503).json({ error: 'VAPID keys 未配置' });
  return response.status(200).json({ publicKey: config.publicKey });
}
