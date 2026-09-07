import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { ApiRequest } from './http.js';

export const SESSION_COOKIE_NAME = 'keepfit_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface AuthFailure {
  status: 401 | 503;
  error: string;
}

const header = (request: ApiRequest, name: string) => {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const configuredPassword = () => process.env.APP_ACCESS_PASSWORD?.trim() ?? '';

const digest = (value: string) => createHash('sha256').update(value).digest();

const constantTimeEqual = (left: string, right: string) =>
  timingSafeEqual(digest(left), digest(right));

const sessionSignature = (issuedAt: number, password: string) =>
  createHmac('sha256', password).update(`keepfit-session-v1:${issuedAt}`).digest('hex');

export const createSessionCookie = (password: string, now = Date.now()) => {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return [
    `${SESSION_COOKIE_NAME}=v1.${now}.${sessionSignature(now, password)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    ...(process.env.VERCEL_ENV ? ['Secure'] : []),
  ].join('; ');
};

export const clearSessionCookie = () =>
  `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.VERCEL_ENV ? '; Secure' : ''}`;

const cookieValue = (request: ApiRequest) => {
  const cookies = header(request, 'cookie');
  if (!cookies) return null;
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
};

export const isAuthenticated = (request: ApiRequest, now = Date.now()) => {
  const password = configuredPassword();
  const token = cookieValue(request);
  if (!password || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const issuedAt = Number(parts[1]);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now || now - issuedAt > SESSION_TTL_MS) return false;
  try {
    return constantTimeEqual(parts[2], sessionSignature(issuedAt, password));
  } catch {
    return false;
  }
};

export const authFailure = (request: ApiRequest, now = Date.now()): AuthFailure | null => {
  if (!configuredPassword()) return { status: 503, error: '访问尚未配置' };
  if (!isAuthenticated(request, now)) return { status: 401, error: '未登录' };
  return null;
};

export const validateAccessPassword = (value: unknown) =>
  typeof value === 'string'
  && value.trim().length > 0
  && value.trim().length <= 200
  && constantTimeEqual(value.trim(), configuredPassword());
