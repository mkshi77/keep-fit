import { completeWorkoutInNotion, dateInTimeZone, validateCompletionPayload } from '../../server/workout.js';
import { isAllowedBrowserOrigin, type ApiRequest, type ApiResponse } from '../../server/http.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAllowedBrowserOrigin(request)) return response.status(403).json({ error: '不允许的请求来源' });

  try {
    const payload = validateCompletionPayload(request.body);
    if (payload.date !== dateInTimeZone()) {
      return response.status(400).json({ error: '只允许提交今天的训练记录' });
    }
    const result = await completeWorkoutInNotion(payload);
    return response.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '训练写回失败';
    const status = /未配置|不可用/.test(message) ? 503 : 400;
    console.error('Workout completion failed', message);
    return response.status(status).json({ error: message });
  }
}
