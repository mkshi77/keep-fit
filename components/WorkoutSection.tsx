import { ChevronRight } from 'lucide-react';
import React from 'react';
import type { ExercisePlan, TodayWorkout } from '../types';
import ExerciseCover from './ExerciseCover';

interface WorkoutSectionProps {
  workout: TodayWorkout | null;
  isLoading: boolean;
  onOpenExerciseModal: (exercise: ExercisePlan) => void;
  onRetry: () => void;
}

const WorkoutSection: React.FC<WorkoutSectionProps> = ({ workout, isLoading, onOpenExerciseModal, onRetry }) => {
  if (isLoading && !workout) return <p className="py-8 text-center text-sm text-gray-400">正在同步今日训练…</p>;
  return (
    <section aria-label="今日动作">
      {workout?.warning && <p className="mb-4 text-sm text-orange-300">{workout.warning}。草稿仍保存在本机。<button onClick={onRetry} className="ml-2 underline">重试同步</button></p>}
      {workout?.isRecoveryDay ? (
        <p className="rounded-2xl bg-[#161616] p-6 text-sm leading-relaxed text-gray-300">今天好好恢复。保持睡眠和轻度活动，为下一次训练蓄力。</p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-base font-bold">今日动作</h2><span className="text-xs text-[#8B93A3]">{workout?.exercises.length ?? 0} 个动作</span></div>
          <ol className="space-y-2">
            {workout?.exercises.map((exercise, index) => (
              <li key={exercise.exerciseId} className="overflow-hidden rounded-2xl bg-[#151515]">
                <button onClick={() => onOpenExerciseModal(exercise)} aria-label={exercise.name + ' 动作详情'} className="flex min-h-[68px] w-full items-center gap-3 px-3 py-2.5 text-left active:bg-[#1B1B1B]">
                  <span className="w-5 shrink-0 text-center text-[10px] font-bold tabular-nums text-[#8B93A3]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl"><ExerciseCover exercise={exercise} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold">{exercise.name}</span><span className="mt-1 block truncate text-[11px] text-[#8B93A3]">{exercise.planSets} 组 · {exercise.planReps} 次 · {exercise.planWeight || '重量待定'}</span></span>
                  <span className="rounded-lg bg-[#1B1B1B] px-2 py-1 text-[10px] text-[#8B93A3]">说明</span>
                  <ChevronRight size={14} className="sr-only" />
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
};

export default WorkoutSection;
