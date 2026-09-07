import React, { useEffect, useMemo, useState } from 'react';
import { currentWorkoutSets, validWorkoutSet, workoutProgress } from '../services/workoutFlow';
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
  exerciseId?: string;
  onExerciseChange: (exerciseId: string) => void;
  onFinish: () => void;
  isSubmitting: boolean;
}

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
  exerciseId,
  onExerciseChange,
  onFinish,
  isSubmitting,
}) => {
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [rest, setRest] = useState<RestState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const exercises = workout?.exercises ?? [];
  const exerciseIndex = Math.max(0, exercises.findIndex((item) => item.exerciseId === exerciseId));
  const exercise = exercises[Math.min(exerciseIndex, Math.max(0, exercises.length - 1))] || null;
  const sets = useMemo(() => {
    if (!exercise) return [] as WorkoutSet[];
    return currentWorkoutSets(exercise, sessionData, lastWeights);
  }, [exercise, sessionData, lastWeights]);
  const currentSetIndex = sets.findIndex((set) => !set.completed);
  const currentSet = currentSetIndex >= 0 ? sets[currentSetIndex] : null;
  const feedback = exercise ? feedbackData[exercise.exerciseId] || {} : {};
  const completedSets = sets.filter((set) => set.completed).length;
  const { total: totalSets, completed: completedTotalSets, remaining } = workoutProgress(workout, sessionData);

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
    const current = currentWorkoutSets(exercise, sessionData, lastWeights);
    const next = [...current];
    next[index] = { ...next[index], [field]: value };
    onSessionChange(
      { ...sessionData, [exercise.exerciseId]: next },
      field === 'weight' ? exercise.exerciseId : undefined,
      field === 'weight' ? String(value) : undefined,
    );
  };

  const completeSet = () => {
    if (!exercise || currentSetIndex < 0 || !currentSet || !validWorkoutSet(currentSet)) return;
    const current = currentWorkoutSets(exercise, sessionData, lastWeights);
    const next = [...current];
    next[currentSetIndex] = { ...next[currentSetIndex], completed: true };
    onSessionChange({ ...sessionData, [exercise.exerciseId]: next }, exercise.exerciseId, next[currentSetIndex].weight);
    setNow(Date.now());
    setRest({ endsAt: Date.now() + restFor(exercise) * 1000, exerciseId: exercise.exerciseId, nextSetIndex: currentSetIndex + 1 });
  };

  const adjustRest = (seconds: number) => {
    setRest((current) => {
      if (!current) return current;
      return { ...current, endsAt: Math.max(Date.now(), current.endsAt) + seconds * 1000 };
    });
  };

  const goToExercise = (index: number) => {
    setRest(null);
    const next = exercises[Math.max(0, Math.min(exercises.length - 1, index))];
    if (next) onExerciseChange(next.exerciseId);
  };

  const skipExercise = () => {
    if (!exercise) return;
    if (exerciseIndex < exercises.length - 1) goToExercise(exerciseIndex + 1);
    else setConfirmFinish(true);
  };

  const finish = () => {
    if (remaining > 0 || completedTotalSets === 0) setConfirmFinish(true);
    else onFinish();
  };

  const remainingSeconds = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  const nextSet = exercise && sets[rest?.nextSetIndex ?? currentSetIndex] ? sets[rest?.nextSetIndex ?? currentSetIndex] : null;

  if (!workout || !exercise) {
    return (
      <div role="dialog" aria-modal="true" aria-label="训练模式" className="fixed inset-0 z-[90] bg-black text-white">
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
    <div role="dialog" aria-modal="true" aria-label="训练模式" className="fixed inset-0 z-[90] bg-black text-white">
      <div className="mx-auto flex h-full w-full max-w-[440px] flex-col px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))]">
        <fieldset disabled={isSubmitting} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">{workout.date} · {workout.trainingDay ? workout.trainingDay + ' 日' : '训练日'}</p>
            <h1 className="mt-1 text-xl font-black text-white">训练模式</h1>
            <button onClick={onExit} className="mt-2 text-sm text-gray-400">暂存并返回</button>
          </div>
          <button onClick={finish} className="rounded-lg bg-[#1a1a1a] px-3 py-3 text-sm font-bold text-gray-300">{isSubmitting ? '正在保存…' : '结束训练'}</button>
        </header>

        <div className="mt-4 rounded-xl bg-[#111] p-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>动作 {exerciseIndex + 1}/{exercises.length}</span>
            <span>已完成 {completedTotalSets}/{totalSets} 组</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#242424]">
            <div className="h-full bg-[#a4ff4f] transition-all" style={{ width: totalSets ? Math.round((completedTotalSets / totalSets) * 100) + '%' : '0%' }} />
          </div>
        </div>

        <section className="mt-4 min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => onOpenExerciseModal(exercise)} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl" aria-label={`${exercise.name} 动作详情`}>
                <ExerciseCover exercise={exercise} />
              </button>
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold">{exercise.name}</h2>
                <p className="mt-1 text-xs text-gray-500">{exercise.planWeight || '--'} · {exercise.planSets} × {exercise.planReps}</p>
              </div>
            </div>
            <button onClick={() => skipExercise()} className="rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-gray-400">跳过动作</button>
          </div>

          <div className="mt-4 rounded-2xl bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm text-gray-500">当前组</h2>
              <span className="text-sm font-bold text-[#a4ff4f]">{currentSetIndex >= 0 ? currentSetIndex + 1 : sets.length}/{sets.length}</span>
            </div>

            {currentSet ? (
              <div key={`${exercise.exerciseId}-${currentSetIndex}`} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="rounded-xl bg-[#181818] px-3 py-3">
                    <span className="block text-[11px] font-bold text-gray-500">重量 KG</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
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
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={currentSet.reps}
                      onChange={(event) => updateSet(currentSetIndex, 'reps', event.target.value)}
                      className="mt-1 w-full bg-transparent text-center text-3xl font-black outline-none"
                      placeholder="0"
                    />
                  </label>
                </div>
                <button onClick={completeSet} disabled={!validWorkoutSet(currentSet)} className="disabled:opacity-40 h-14 w-full rounded-xl bg-[#a4ff4f] text-lg font-black text-black">完成本组</button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-[#181818] p-4 text-center text-sm text-gray-400">本动作组数已完成</div>
            )}

            {completedSets > 0 && (
              <div className="mt-5">
                <h3 className="text-xs font-bold text-gray-500">已完成组</h3>
                <div className="mt-2 space-y-1">
                  {sets.filter((set) => set.completed).map((set, index) => (
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
                    { key: 'rir', label: '末组 RIR 0–10', max: 10 },
                    { key: 'asymmetry', label: '左右差异 0–3', max: 3 },
                    { key: 'discomfort', label: '不适 0–10', max: 10 },
                  ].map((item) => (
                    <label key={item.key} className="rounded-lg bg-[#111] p-3 text-center">
                      <span className="block text-[10px] text-gray-500">{item.label}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={item.max}
                        step="1"
                        value={feedback[item.key as keyof ExerciseFeedback] ?? ''}
                        onChange={(event) => {
                          const value = event.target.value === '' ? undefined : Number(event.target.value);
                          if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > item.max)) return;
                          onFeedbackChange(exercise.exerciseId, { ...feedback, [item.key]: value });
                        }}
                        className="mt-1 w-full bg-transparent text-center text-lg font-black outline-none"
                        placeholder="-"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={onAskAI} className="mt-4 w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-gray-300">告诉 AI</button>
        </section>

        {rest && (
          <section aria-label="组间休息" className="mt-3 rounded-2xl bg-[#171717] p-3">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs text-gray-400">组间休息</p><p role="timer" className="mt-1 text-3xl font-bold tabular-nums">{formatClock(remainingSeconds)}</p></div>
              <button onClick={() => adjustRest(30)} className="rounded-full bg-[#292929] px-3 py-3 text-sm">+30s</button>
              <button onClick={() => setRest(null)} className="px-2 py-3 text-sm text-gray-300">跳过休息</button>
            </div>
            <p className="mt-2 text-xs text-gray-400">{nextSet ? '下一组：' + (nextSet.weight || '--') + ' kg × ' + nextSet.reps : '本动作已完成，可以填写反馈'}</p>
          </section>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => goToExercise(exerciseIndex - 1)} disabled={exerciseIndex === 0} className="h-12 rounded-xl bg-[#1a1a1a] text-sm font-bold text-gray-300 disabled:opacity-40">上一动作</button>
          <button onClick={() => goToExercise(exerciseIndex + 1)} disabled={exerciseIndex === exercises.length - 1} className="h-12 rounded-xl bg-[#1a1a1a] text-sm font-bold text-gray-300 disabled:opacity-40">下一动作</button>
        </div>
        </fieldset>
      </div>

      {confirmFinish && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-5" role="alertdialog" aria-modal="true" aria-labelledby="finish-title">
          <div className="w-full max-w-sm rounded-2xl bg-[#202020] p-5">
            <h2 id="finish-title" className="text-lg font-bold">{completedTotalSets === 0 ? '还没有完成的训练组' : '还有 ' + remaining + ' 组未完成，确定结束训练吗？'}</h2>
            <p className="mt-3 text-sm text-gray-400">{completedTotalSets === 0 ? '先完成一组，或暂存草稿返回今日。' : '仅保存已经完成的内容，未完成组不会计入训练记录。'}</p>
            <button autoFocus onClick={() => setConfirmFinish(false)} disabled={isSubmitting} className="mt-5 h-12 w-full rounded-xl bg-[#a4ff4f] font-bold text-black">继续训练</button>
            {completedTotalSets > 0
              ? <button onClick={() => { setConfirmFinish(false); onFinish(); }} disabled={isSubmitting} className="mt-3 min-h-12 w-full rounded-xl bg-[#333] px-3 py-3 text-sm">结束并保存当前完成内容</button>
              : <button onClick={onExit} className="mt-3 h-12 w-full rounded-xl bg-[#333] text-sm">暂存并返回</button>}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutMode;
