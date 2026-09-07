interface RateLimitState {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitState>();

export const AI_RATE_LIMIT = 20;
export const AI_RATE_WINDOW_MS = 5 * 60 * 1000;

export const resetRateLimits = () => store.clear();

export const clientRateLimitKey = (headers: ApiRequestHeaders) => {
  const forwarded = headers['x-forwarded-for'] ?? headers['X-Forwarded-For'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return ip?.split(',')[0]?.trim() || 'unknown';
};

export const consumeRateLimit = (
  key: string,
  limit = AI_RATE_LIMIT,
  windowMs = AI_RATE_WINDOW_MS,
  now = Date.now(),
) => {
  for (const [existingKey, state] of store) {
    if (state.resetAt <= now) store.delete(existingKey);
  }

  const current = store.get(key);
  if (current && current.resetAt > now) {
    current.count += 1;
    return { allowed: current.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  store.set(key, { count: 1, resetAt: now + windowMs });
  return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
};

interface ApiRequestHeaders {
  [key: string]: string | string[] | undefined;
}
