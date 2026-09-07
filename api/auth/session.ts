import { authFailure, clearSessionCookie, createSessionCookie, validateAccessPassword } from '../../server/auth.js';
import { isAllowedBrowserOrigin, type ApiRequest, type ApiResponse } from '../../server/http.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (!['GET', 'POST', 'DELETE'].includes(request.method ?? '')) {
    response.setHeader('Allow', 'GET, POST, DELETE');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  if (request.method !== 'POST' && !isAllowedBrowserOrigin(request)) {
    return response.status(403).json({ error: '不允许的请求来源' });
  }

  if (request.method === 'GET') {
    const failure = authFailure(request);
    if (failure) return response.status(failure.status).json(failure);
    return response.status(200).json({ authenticated: true });
  }

  if (request.method === 'DELETE') {
    response.setHeader('Set-Cookie', clearSessionCookie());
    return response.status(200).json({ authenticated: false });
  }

  if (!isAllowedBrowserOrigin(request)) return response.status(403).json({ error: '不允许的请求来源' });
  if (!validateAccessPassword((request.body as { password?: unknown } | undefined)?.password)) {
    return response.status(401).json({ error: '访问密码错误' });
  }

  const password = String(process.env.APP_ACCESS_PASSWORD).trim();
  response.setHeader('Set-Cookie', createSessionCookie(password));
  return response.status(200).json({ authenticated: true });
}
