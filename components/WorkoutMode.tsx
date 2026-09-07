import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETS } from '../constants';
import type { ExerciseFeedback, ExercisePlan, TodayWorkout, WorkoutSet } from '../types';
import ExerciseCover from './ExerciseCover';

interface WorkoutModeProps {
  workout: TodayWorkout | null;
  lastWeights: Record<string, string>;
  sessionData: Record<string, WorkoutSet[]>;
  feedbackData: Record<string, ExerciseFeedback>;
  onSessionChange: (newData: Record<string, WorkoutSet[]>, exerciseId?: string, weight?: string) => void;
  onFeedbackChange: (exerciseId: string, feedback: ExerciseFeedback) => void;
  onOpenExerciseModal: (exercise: ExercisePlan) => void;
  onAskAI: () => void;
  onExit: () => void;
}

const makeSets = (exercise: ExercisePlan, lastWeights: Record<string, string>): WorkoutSet[] =>
  Array.from({ length: Math.max(DEFAULT_SETS, exercise.planSets) }, () => ({
    weight: lastWeightOrEmpty(exercise, lastWeights),
    reps: defaultReps(exercise),
    completed: false,
  }));

const lastWeightOrEmpty = (exercise: ExercisePlan, lastWeights: Record<string, string>) => lastWeights[exercise.exerciseId] || '';

const defaultReps = (exercise: ExercisePlan) => exercise.planReps.match(/\d+/)?.[0] || '10';

const restFor = (exercise: ExercisePlan) => exercise.restSeconds ?? 90;

const formatClock = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  return String(Math.floor(safeSeconds / 60)).padStart(2, '0') + ':' + String(safeSeconds % 60).padStart(2, '0');
};

interface RestState {
  endsAt: number;
  exerciseId: string;
  nextSetIndex: number;
}

const WorkoutMode: React.FC<WorkoutModeProps> = ({
  workout,
  lastWeights,
  sessionData,
  feedbackData,
  onSessionChange,
  onFeedbackChange,
  onOpenExerciseModal,
  onAskAI,
  onExit,
}) => {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [rest, setRest] = useState<RestState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const exercises = workout?.exercises ?? [];
  const exercise = exercises[Math.min(exerciseIndex, Math.max(0, exercises.length - 1))] || null;
  const sets = useMemo(() => {
    if (!exercise) return [] as WorkoutSet[];
    return sessionData[exercise.exerciseId] || makeSets(exercise, lastWeights);
  }, [exercise, sessionData, lastWeights]);
  const currentSetIndex = sets.findIndex((set) => !set.completed);
  const currentSet = currentSetIndex >= 0 ? sets[currentSetIndex] : null;
  const feedback = exercise ? feedbackData[exercise.exerciseId] || {} : {};
  const completedSets = sets.filter((set) => set.completed).length;
  const totalSets = exercises.reduce((total, item) => total + (sessionData[item.exerciseId] || makeSets(item, lastWeights)).length, 0);
  const completedTotalSets = exercises.reduce((total, item) => {
    const itemSets = sessionData[item.exerciseId] || makeSets(item, lastWeights);
    return total + itemSets.filter((set) => set.completed).length;
  }, 0);

  useEffect(() => {
    if (!rest) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 250);
    const onVisibilityChange = () => tick();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [rest]);

  useEffect(() => {
    if (rest && now >= rest.endsAt) setRest(null);
  }, [now, rest]);

  const updateSet = (index: number, field: keyof WorkoutSet, value: string | boolean) => {
    if (!exercise) return;
    const current = sessionData[exercise.exerciseId] || makeSets(exercise, lastWeights);
    const next = [...current];
    next[index] = { ...next[index], [field]: value };
    onSessionChange(
      { ...sessionData, [exercise.exerciseId]: next },
      field === 'weight' ? exercise.exerciseId : undefined,
      field === 'weight' ? String(value) : undefined,
    );
  };

  const completeSet = () => {
    if (!exercise || currentSetIndex < 0) return;
    const current = sessionData[exercise.exerciseId] || makeSets(exercise, lastWeights);
    const next = [...current];
    next[currentSetIndex] = { ...next[currentSetIndex], completed: true };
    onSessionChange({ ...sessionData, [exercise.exerciseId]: next }, exercise.exerciseId, next[currentSetIndex].weight);
    if (currentSetIndex + 1 < next.length) {
      setRest({ endsAt: Date.now() + restFor(exercise) * 1000, exerciseId: exercise.exerciseId, nextSetIndex: currentSetIndex + 1 });
    }
  };

  const startRest = (seconds: number) => {
    if (!exercise) return;
    setRest({ endsAt: Date.now() + seconds * 1000, exerciseId: exercise.exerciseId, nextSetIndex: currentSetIndex });
  };

  const adjustRest = (seconds: number) => {
    setRest((current) => {
      if (!current) return current;
      return { ...current, endsAt: Math.max(Date.now(), current.endsAt) + seconds * 1000 };
    });
  };

  const goToExercise = (index: number) => {
    setRest(null);
    setExerciseIndex(Math.max(0, Math.min(exercises.length - 1, index)));
  };

  const skipExercise = () => {
    if (!exercise) return;
    if (exerciseIndex < exercises.length - 1) goToExercise(exerciseIndex + 1);
    else onExit();
  };

  const remainingSeconds = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  const nextSet = exercise && sets[rest?.nextSetIndex ?? currentSetIndex] ? sets[rest?.nextSetIndex ?? currentSetIndex] : null;

  if (!workout || !exercise) {
    return (
      <div className="fixed inset-0 z-[90] bg-black text-white">
        <div className="flex h-full items-center justify-center px-6 text-center">
          <div>
            <p className="text-gray-500 text-sm">今日训练暂不可用</p>
            <button onClick={onExit} className="mt-4 rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-bold text-gray-300">返回今日</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black text-white">
      <div className="mx-auto flex h-full w-full max-w-[440px] flex-col px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))]">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">{workout.date} · {workout.trainingDay ? workout.trainingDay + ' 日' : '训练日'}</p>
            <h1 className="mt-1 text-xl font-black text-white">训练模式</h1>
          </div>
          <button onClick={onExit} className="rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-gray-400">结束训练</button>
        </header>

        <div className="mt-4 rounded-xl bg-[#111] p-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>动作 {exerciseIndex + 1}/{exercises.length}</span>
            <span>已完成 {completedTotalSets}/{totalSets} 组</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#242424]">
            <div className="h-full bg-accent transition-all" style={{ width: totalSets ? Math.round((completedTotalSets / totalSets) * 100) + '%' : '0%' }} />
          </div>
        </div>

        <section className="mt-4 flex-1 overflow-y-auto no-scrollbar">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => onOpenExerciseModal(exercise)} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl" aria-label={`${exercise.name} 动作详情`}>
                <ExerciseCover exercise={exercise} />
              </button>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{exercise.name}</h2>
                <p className="mt-1 text-xs text-gray-500">{exercise.planWeight || '--'} · {exercise.planSets} × {exercise.planReps}</p>
              </div>
            </div>
            <button onClick={() => skipExercise()} className="rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-gray-400">跳过动作</button>
          </div>

          <div className="mt-4 rounded-2xl bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm text-gray-500">当前组</h2>
              <span className="text-sm font-bold text-accent">{currentSetIndex >= 0 ? currentSetIndex + 1 : sets.length}/{sets.length}</span>
            </div>

            {currentSet ? (
              <div key={`${exercise.exerciseId}-${currentSetIndex}`} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="rounded-xl bg-[#181818] px-3 py-3">
                    <span className="block text-[11px] font-bold text-gray-500">重量 KG</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      autoFocus
                      value={currentSet.weight}
                      onChange={(event) => updateSet(currentSetIndex, 'weight', event.target.value)}
                      className="mt-1 w-full bg-transparent text-right text-3xl font-black outline-none"
                      placeholder="0"
                    />
                  </label>
                  <label className="rounded-xl bg-[#181818] px-3 py-3">
                    <span className="block text-[11px] font-bold text-gray-500">次数</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={currentSet.reps}
                      onChange={(event) => updateSet(currentSetIndex, 'reps', event.target.value)}
                      className="mt-1 w-full text-center text-3xl font-black outline-none"
                      placeholder="0"
                    />
                  </label>
                </div>
                <button onClick={completeSet} className="h-14 w-full rounded-xl bg-accent text-lg font-black text-black">完成本组</button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-[#181818] p-4 text-center text-sm text-gray-400">本动作组数已完成</div>
            )}

            {completedSets > 0 && (
              <div className="mt-5">
                <h3 className="text-xs font-bold text-gray-500">已完成组</h3>
                <div className="mt-2 space-y-1">
                  {sets.slice(0, completedSets).map((set, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg bg-[#181818] px-3 py-2 text-sm">
                      <span className="text-gray-500">第 {index + 1} 组</span>
                      <span className="font-bold text-white">{set.weight || '--'} kg × {set.reps || '--'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sets.length > 0 && currentSetIndex < 0 && (
              <div className="mt-4 space-y-3 rounded-xl bg-[#181818] p-4">
                <h3 className="text-sm font-bold text-white">动作反馈</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'rir', label: '末组 RIR' },
                    { key: 'asymmetry', label: '左右差' },
                    { key: 'discomfort', label: '不适' },
                  ].map((item) => (
                    <label key={item.key} className="rounded-lg bg-[#111] p-3 text-center">
                      <span className="block text-[10px] text-gray-500">{item.label}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={feedback[item.key as keyof ExerciseFeedback] ?? ''}
                        onChange={(event) => {
                          const value = event.target.value === '' ? undefined : Number(event.target.value);
                          onFeedbackChange(exercise.exerciseId, { ...feedback, [item.key]: value });
                        }}
                        className="mt-1 w-full bg-transparent text-center text-lg font-black outline-none"
                        placeholder="-"
                      />
                    </label>
                  ))}
                </div>
                {(feedback.discomfort ?? 0) >= 4 && (
                  <button onClick={onAskAI} className="w-full rounded-lg bg-[#111] px-3 py-2 text-sm font-bold text-accent">告诉 AI</button>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => goToExercise(exerciseIndex - 1)} disabled={exerciseIndex === 0} className="h-12 rounded-xl bg-[#1a1a1a] text-sm font-bold text-gray-300 disabled:opacity-40">上一动作</button>
          <button onClick={() => goToExercise(exerciseIndex + 1)} disabled={exerciseIndex === exercises.length - 1} className="h-12 rounded-xl bg-[#1a1a1a] text-sm font-bold text-gray-300 disabled:opacity-40">下一动作</button>
        </div>
      </div>

      {rest && (
        <div className="fixed inset-0 z-[110] bg-black/95 px-4 pt-[calc(14px+env(safe-area-inset-top))] pb-[calc(18px+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex h-full w-full max-w-[440px] flex-col items-center justify-center">
            <p className="text-sm text-gray-500">组间休息</p>
            <div className="mt-2 text-6xl font-black text-accent">{formatClock(remainingSeconds)}</div>
            <div className="mt-4 w-full rounded-xl bg-[#111] p-4 text-center">
              <p className="text-xs text-gray-500">下一组</p>
              <p className="mt-1 text-lg font-bold text-white">{nextSet ? `${nextSet.weight || '--'} kg × ${nextSet.reps || '--'}` : '--'}</p>
            </div>
            <div className="mt-6 grid w-full grid-cols-3 gap-3">
              <button onClick={() => adjustRest(-15)} className="h-12 rounded-xl bg-[#1a1a1a] text-sm font-bold text-gray-300">-15s</button>
              <button onClick={() => startRest(restFor(exercise))} className="h-12 rounded-xl bg-[#1a1a1a] text-sm font-bold text-gray-300">重置</button>
              <button onClick={() => adjustRest(15)} className="h-12 rounded-xl bg-[#1a1a1a] text-sm font-bold text-gray-300">+15s</button>
            </div>
            <button onClick={() => setRest(null)} className="mt-4 h-12 w-full rounded-xl bg-accent text-lg font-black text-black">跳过休息</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutMode;
