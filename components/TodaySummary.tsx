import React from 'react';
import type { TodayWorkout } from '../types';

interface TodaySummaryProps {
  workout: TodayWorkout | null;
  isFilled: boolean;
  onStart: () => void;
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

const TodaySummary: React.FC<TodaySummaryProps> = ({ workout, isFilled, onStart }) => {
  const summary = getTodaySummary(workout);
  const date = new Date((workout?.date || new Date().toISOString().slice(0, 10)) + 'T12:00:00');
  const validDate = !Number.isNaN(date.getTime()) ? date : new Date();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][validDate.getDay()];

  return (
    <section className="px-4" aria-labelledby="today-summary-title">
      <div className="rounded-2xl bg-[#0f0f0f] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">{month}/{day} · {weekDay}</p>
            <h2 id="today-summary-title" className="mt-1 text-3xl font-black text-white">{summary.planLabel}</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${!workout ? 'bg-[#1d1d1d] text-gray-500' : workout.isRecoveryDay ? 'bg-rest text-black' : 'bg-accent text-black'}`}>
            {workout?.isRecoveryDay ? '恢复日' : workout?.trainingDay ? '训练日' : '加载中'}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: '动作', value: summary.exerciseCount },
            { label: '组数', value: summary.totalSets },
            { label: '预计', value: summary.estimatedMinutes + '分' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-[#171717] px-3 py-3 text-center">
              <dt className="text-[11px] text-gray-500">{item.label}</dt>
              <dd className="mt-1 text-xl font-black text-white">{item.value}</dd>
            </div>
          ))}
        </dl>

        <button onClick={onStart} className="mt-5 h-12 w-full rounded-xl bg-accent text-base font-bold text-black transition-colors active:bg-white">
          {isFilled ? '查看今日动作' : '开始训练'}
        </button>
      </div>
    </section>
  );
};

export default TodaySummary;
