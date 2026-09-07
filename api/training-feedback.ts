import { validateTrainingFeedbackPayload, recordTrainingFeedback } from '../server/trainingFeedback.js';
import { dateInTimeZone } from '../server/workout.js';
import { authFailure } from '../server/auth.js';
import { clientRateLimitKey, consumeRateLimit } from '../server/rate-limit.js';
import { isAllowedBrowserOrigin, type ApiRequest, type ApiResponse } from '../server/http.js';

interface TrainingFeedbackBody extends Record<string, unknown> {
  confirmed?: boolean;
  [key: string]: unknown;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAllowedBrowserOrigin(request)) return response.status(403).json({ error: '不允许的请求来源' });
  const failure = authFailure(request);
  if (failure) return response.status(failure.status).json(failure);

  const rate = consumeRateLimit(clientRateLimitKey(request.headers));
  if (!rate.allowed) {
    response.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return response.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }

  const body = (request.body ?? {}) as TrainingFeedbackBody;
  if (body.confirmed !== true) return response.status(400).json({ error: '需要用户确认后才能写入' });

  try {
    const payload = validateTrainingFeedbackPayload(body);
    if (payload.date !== dateInTimeZone()) return response.status(400).json({ error: '只允许提交今天的训练反馈' });
    const result = await recordTrainingFeedback(payload);
    return response.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '训练反馈写入失败';
    const status = /未配置|缺少.*schema/.test(message) ? 503 : 400;
    console.error('Training feedback write failed', message);
    return response.status(status).json({ error: message });
  }
}
