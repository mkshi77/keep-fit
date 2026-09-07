import { authFailure } from '../../server/auth.js';
import { dateInTimeZone, getTodayWorkoutFromNotion } from '../../server/workout.js';
import type { ApiRequest, ApiResponse } from '../../server/http.js';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const failure = authFailure(request);
  if (failure) return response.status(failure.status).json(failure);

  const date = dateInTimeZone();
  const workout = await getTodayWorkoutFromNotion(date);
  return response.status(200).json(workout);
}
