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
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">今日动作</h2><span className="text-sm text-gray-400">{workout?.exercises.length ?? 0} 个动作</span></div>
          <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-[#161616]">
            {workout?.exercises.map((exercise, index) => (
              <li key={exercise.exerciseId}>
                <button onClick={() => onOpenExerciseModal(exercise)} aria-label={exercise.name + ' 动作详情'} className="flex w-full items-center gap-3 px-3 py-4 text-left">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-gray-300">{index + 1}</span>
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"><ExerciseCover exercise={exercise} /></span>
                  <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{exercise.name}</span><span className="mt-1 block text-xs text-gray-400">{exercise.planSets} × {exercise.planReps} · {exercise.planWeight || '重量待定'}</span></span>
                  <ChevronRight size={18} className="shrink-0 text-gray-400" />
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
