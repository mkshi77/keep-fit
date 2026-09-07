import type { AIChatMessage, AIWorkoutContext, WorkoutReviewPayload } from '../types';

export const sendAIMessage = async (messages: AIChatMessage[], context: AIWorkoutContext) => {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ messages, context }),
  });
  const data = await response.json().catch(() => null) as { content?: string; error?: string } | null;
  if (!response.ok || !data?.content) throw new Error(data?.error || 'AI 服务暂时不可用');
  return data.content;
};

export const requestWorkoutReview = async (summary: WorkoutReviewPayload) => {
  const response = await fetch('/api/ai/workout-review', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ summary }),
  });
  const data = await response.json().catch(() => null) as { content?: string; error?: string } | null;
  if (!response.ok || !data?.content) throw new Error(data?.error || 'AI 复盘暂时不可用');
  return data.content;
};
