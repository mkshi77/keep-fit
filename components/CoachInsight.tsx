import React, { useEffect, useState } from 'react';
import type { HistoryRecord, TodayWorkout } from '../types';
import { listConversations, listMessages } from '../services/aiConversationStore';

export const previousTrainingDate = (workout: TodayWorkout, history: Record<string, HistoryRecord>) =>
  Object.keys(history).filter((date) => date < workout.date && history[date].type === 'workout' && history[date].workoutPlan === workout.trainingDay).sort().at(-1);

const CoachInsight: React.FC<{ workout: TodayWorkout | null; history: Record<string, HistoryRecord>; hasDraft: boolean }> = ({ workout, history, hasDraft }) => {
  const [review, setReview] = useState('');
  const previousDate = workout && !workout.isRecoveryDay ? previousTrainingDate(workout, history) : undefined;
  useEffect(() => {
    let cancelled = false;
    setReview('');
    if (previousDate) {
      void listConversations().then(async (conversations) => {
        const conversation = conversations.find((item) => item.type === 'daily-workout' && item.title === `今日训练 · ${previousDate}`);
        if (!conversation) return;
        const messages = await listMessages(conversation.id);
        const content = messages.find((message) => message.role === 'assistant')?.content ?? '';
        const excerpt = content.replace(/[#*`]/g, '').replace(/\s+/g, ' ').trim();
        if (!cancelled) setReview(excerpt.length > 140 ? excerpt.slice(0, 140) + '…' : excerpt);
      }).catch(() => { /* A missing local review must not block today's plan. */ });
    }
    return () => { cancelled = true; };
  }, [previousDate]);

  return (
    <section className="rounded-2xl bg-[#151515] px-4 py-3" aria-label="教练提示">
      <div className="flex items-center justify-between gap-3"><h2 className="text-[11px] font-bold text-[#9EFF3F]">● AI 教练重点提醒</h2>{review && <span className="text-[10px] text-[#8B93A3]">针对今日训练</span>}</div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#D1D5DB]">{review || (hasDraft ? '训练进行中，草稿已保留。继续把每一组做扎实。' : workout?.isRecoveryDay ? '恢复也是训练的一部分。今天放慢一点，下次稳稳推进。' : '先稳定动作和轨迹，再根据末组 RIR 决定是否完成第 4 组。')}</p>
    </section>
  );
};

export default CoachInsight;
