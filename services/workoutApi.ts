import type { TodayWorkout, WorkoutCompletionPayload } from '../types';

const parseError = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return data?.error || fallback;
};

export const getTodayWorkout = async (): Promise<TodayWorkout> => {
  const response = await fetch('/api/workout/today', {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(await parseError(response, '无法读取今日训练'));
  return response.json() as Promise<TodayWorkout>;
};

export const completeWorkout = async (payload: WorkoutCompletionPayload) => {
  const response = await fetch('/api/workout/complete', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response, '训练写回失败，请重试'));
  return response.json() as Promise<{ success: true; updated: number }>;
};
