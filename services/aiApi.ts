import type { AIChatMessage, AIWorkoutContext } from '../types';

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
