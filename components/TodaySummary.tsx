import { Settings } from 'lucide-react';
import React from 'react';
import type { TodayWorkout } from '../types';

interface TodaySummaryProps {
  workout: TodayWorkout | null;
  filledCount: number;
  onOpenSettings: () => void;
}

export const getTodaySummary = (workout: TodayWorkout | null) => {
  const exerciseCount = workout?.isRecoveryDay ? 0 : workout?.exercises.length ?? 0;
  const totalSets = workout?.isRecoveryDay ? 0 : (workout?.exercises ?? []).reduce((total, exercise) => total + exercise.planSets, 0);
  return {
    exerciseCount,
    totalSets,
    estimatedMinutes: totalSets * 3,
    planLabel: workout?.isRecoveryDay ? 'Recovery' : workout?.trainingDay ? workout.trainingDay + ' 日' : '今日计划',
  };
};

const TodaySummary: React.FC<TodaySummaryProps> = ({ workout, filledCount, onOpenSettings }) => {
  const summary = getTodaySummary(workout);
  const date = new Date((workout?.date || new Date().toISOString().slice(0, 10)) + 'T12:00:00');
  const validDate = !Number.isNaN(date.getTime()) ? date : new Date();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][validDate.getDay()];

  return (
    <section className="px-4 pt-[calc(18px+env(safe-area-inset-top))]" aria-labelledby="today-summary-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-[#8B93A3]">{month}月{day}日 · {weekDay}</p>
          <h1 id="today-summary-title" className="mt-1 text-[28px] font-black leading-8 tracking-tight text-[#F5F5F5]">今天训练</h1>
          <p className="mt-1 text-xs font-medium text-[#8B93A3]">
            {summary.exerciseCount} 个动作 · {summary.totalSets} 组 · 约 {summary.estimatedMinutes || 0} 分钟
          </p>
        </div>
        <div className="flex items-center gap-1">
          <h2 className="rounded-full bg-[#151515] px-2.5 py-1 text-[11px] font-bold text-[#F5F5F5]">
            {workout?.isRecoveryDay ? '恢复日' : workout?.trainingDay ? `${workout.trainingDay} 日` : '同步中'}
          </h2>
          <button onClick={onOpenSettings} aria-label="设置" className="flex h-10 w-10 items-center justify-center rounded-full text-[#8B93A3]">
            <Settings size={18} />
          </button>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-[#48484A]">已记录 {filledCount} 天</p>
    </section>
  );
};

export default TodaySummary;
