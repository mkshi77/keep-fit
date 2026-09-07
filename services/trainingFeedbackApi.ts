import type { TrainingFeedbackPayload } from '../types';

export const submitTrainingFeedback = async (payload: TrainingFeedbackPayload) => {
  const response = await fetch('/api/training-feedback', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...payload, confirmed: true }),
  });
  const data = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
  if (!response.ok || !data?.success) throw new Error(data?.error || '训练反馈写入失败');
  return data;
};
