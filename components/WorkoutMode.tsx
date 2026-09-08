import { Check, ChevronLeft, Hourglass } from 'lucide-react';
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

interface RestState {
  endsAt: number;
  nextSetIndex: number;
  totalSeconds: number;
}

const restFor = (exercise: ExercisePlan) => exercise.restSeconds ?? 90;
const formatClock = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;

const feedbackOptions = {
  rir: [0, 1, 2, 3, 4],
  asymmetry: [0, 1, 2, 3],
  discomfort: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
} as const;

const FeedbackScale = ({ label, value, options, onChange, inputLabel }: {
  label: string;
  value?: number;
  options: readonly number[];
  onChange: (value: number) => void;
  inputLabel: string;
}) => (
  <fieldset>
    <div className="mb-2 flex items-center justify-between gap-3">
      <legend className="text-xs font-bold text-[#F5F5F5]">{label}</legend>
      <span className="text-[10px] text-[#8B93A3]">{value == null ? '请选择' : value}</span>
    </div>
    <div className="relative flex gap-1.5">
      {options.map((option) => (
        <button key={option} type="button" onClick={() => onChange(option)} className={`h-9 min-w-0 flex-1 rounded-lg text-[11px] font-bold ${value === option ? 'bg-[#9EFF3F] text-[#080808]' : 'bg-[#1B1B1B] text-[#8B93A3]'}`}>
          {option === 4 && inputLabel.startsWith('末组') ? '4+' : option}
        </button>
      ))}
      <input aria-label={inputLabel} type="number" min={options[0]} max={options.at(-1)} value={value ?? ''}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isInteger(next) && next >= options[0] && next <= (options.at(-1) ?? 0)) onChange(next);
        }}
        className="absolute bottom-0 left-0 h-px w-px opacity-0" />
    </div>
  </fieldset>
);

const WorkoutMode: React.FC<WorkoutModeProps> = ({ workout, lastWeights, sessionData, feedbackData, onSessionChange, onFeedbackChange, onOpenExerciseModal, onAskAI, onExit, exerciseId, onExerciseChange, onFinish, isSubmitting }) => {
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [rest, setRest] = useState<RestState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const exercises = workout?.exercises ?? [];
  const exerciseIndex = Math.max(0, exercises.findIndex((item) => item.exerciseId === exerciseId));
  const exercise = exercises[Math.min(exerciseIndex, Math.max(0, exercises.length - 1))] || null;
  const sets = useMemo(() => exercise ? currentWorkoutSets(exercise, sessionData, lastWeights) : [], [exercise, sessionData, lastWeights]);
  const currentSetIndex = sets.findIndex((set) => !set.completed);
  const currentSet = currentSetIndex >= 0 ? sets[currentSetIndex] : null;
  const feedback = exercise ? feedbackData[exercise.exerciseId] || {} : {};
  const completedSets = sets.filter((set) => set.completed);
  const { total: totalSets, completed: completedTotalSets, remaining } = workoutProgress(workout, sessionData);

  useEffect(() => {
    if (!rest) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [rest]);

  useEffect(() => {
    if (rest && now >= rest.endsAt) setRest(null);
  }, [now, rest]);

  const updateSet = (index: number, field: keyof WorkoutSet, value: string | boolean) => {
    if (!exercise) return;
    const next = [...currentWorkoutSets(exercise, sessionData, lastWeights)];
    next[index] = { ...next[index], [field]: value };
    onSessionChange({ ...sessionData, [exercise.exerciseId]: next }, field === 'weight' ? exercise.exerciseId : undefined, field === 'weight' ? String(value) : undefined);
  };

  const completeSet = () => {
    if (!exercise || currentSetIndex < 0 || !currentSet || !validWorkoutSet(currentSet)) return;
    const next = [...currentWorkoutSets(exercise, sessionData, lastWeights)];
    next[currentSetIndex] = { ...next[currentSetIndex], completed: true };
    onSessionChange({ ...sessionData, [exercise.exerciseId]: next }, exercise.exerciseId, next[currentSetIndex].weight);
    if (currentSetIndex < next.length - 1) {
      const totalSeconds = restFor(exercise);
      setNow(Date.now());
      setRest({ endsAt: Date.now() + totalSeconds * 1000, nextSetIndex: currentSetIndex + 1, totalSeconds });
    }
  };

  const adjustCurrentSet = (field: 'weight' | 'reps', delta: number) => {
    if (!currentSet || currentSetIndex < 0) return;
    const current = Number(currentSet[field] || 0);
    const minimum = field === 'weight' ? 0 : 1;
    const next = Math.max(minimum, current + delta);
    updateSet(currentSetIndex, field, String(next));
  };

  const adjustRest = (seconds: number) => setRest((current) => current ? { ...current, endsAt: Math.max(Date.now(), current.endsAt) + seconds * 1000, totalSeconds: Math.max(15, current.totalSeconds + seconds) } : current);
  const goToExercise = (index: number) => {
    setRest(null);
    const next = exercises[Math.max(0, Math.min(exercises.length - 1, index))];
    if (next) onExerciseChange(next.exerciseId);
  };
  const skipExercise = () => exerciseIndex < exercises.length - 1 ? goToExercise(exerciseIndex + 1) : setConfirmFinish(true);
  const finish = () => remaining > 0 || completedTotalSets === 0 ? setConfirmFinish(true) : onFinish();

  if (!workout || !exercise) {
    return <div role="dialog" aria-modal="true" aria-label="训练模式" className="fixed inset-0 z-[90] bg-[#080808] text-white"><div className="flex h-full items-center justify-center px-6 text-center"><div><p className="text-sm text-[#8B93A3]">今日训练暂不可用</p><button onClick={onExit} className="mt-4 rounded-xl bg-[#1B1B1B] px-4 py-3 text-sm font-bold">返回今日</button></div></div></div>;
  }

  const remainingSeconds = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  const nextSet = sets[rest?.nextSetIndex ?? currentSetIndex] ?? null;
  const isFeedback = currentSetIndex < 0;
  const updateFeedback = (key: keyof ExerciseFeedback, value: number) => onFeedbackChange(exercise.exerciseId, { ...feedback, [key]: value });
  const continueAfterFeedback = () => exerciseIndex < exercises.length - 1 ? goToExercise(exerciseIndex + 1) : finish();

  return (
    <div role="dialog" aria-modal="true" aria-label="训练模式" className="fixed inset-0 z-[90] overflow-hidden bg-[#080808] text-[#F5F5F5]">
      <fieldset disabled={isSubmitting} className="mx-auto flex h-full w-full max-w-[440px] flex-col">
        {rest ? (
          <section aria-label="组间休息" className="relative flex h-full flex-col px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(34px+env(safe-area-inset-top))]">
            <div className="mx-auto rounded-full bg-[#151515] px-4 py-2 text-center text-[11px] font-medium text-[#D1D5DB]"><span className="mr-2 text-[#9EFF3F]">●</span>{exercise.name} · 第 {rest.nextSetIndex} 组已完成</div>
            <div className="flex flex-1 items-center justify-center">
              <div className="flex h-[250px] w-[250px] flex-col items-center justify-center rounded-full border border-[#242426] bg-[#0E0E0E] text-center">
                <Hourglass size={18} className="text-[#8B93A3]" />
                <p className="mt-3 text-xs font-bold text-[#8B93A3]">组间休息</p>
                <p role="timer" className="mt-2 text-[54px] font-black leading-none tracking-[-0.04em] tabular-nums">{formatClock(remainingSeconds)}</p>
                <p className="mt-4 rounded-full bg-[#151515] px-3 py-1.5 text-[11px] text-[#D1D5DB]"><span className="mr-2 text-[#9EFF3F]">●</span>下一组：第 {rest.nextSetIndex + 1} 组 · {nextSet?.weight || '--'} kg × {nextSet?.reps || '--'}</p>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-3">
              <button onClick={() => adjustRest(-15)} className="h-14 rounded-xl bg-[#1B1B1B] text-sm font-bold">-15s</button>
              <button onClick={() => setRest(null)} className="h-14 rounded-xl bg-[#1B1B1B] text-sm font-black">跳过休息 <span className="text-[#9EFF3F]">▶▶</span></button>
              <button onClick={() => adjustRest(15)} className="h-14 rounded-xl bg-[#1B1B1B] text-sm font-bold">+15s</button>
            </div>
            <p className="mt-4 text-center text-[11px] text-[#8B93A3]">深呼吸，准备下一组。</p>
          </section>
        ) : isFeedback ? (
          <section aria-label="动作反馈" className="flex h-full flex-col overflow-y-auto px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
            <header className="flex items-start justify-between"><div><p className="text-[11px] text-[#9EFF3F]">动作完成 ✓</p><h1 className="mt-1 text-lg font-black">感觉怎么样？</h1><p className="mt-1 text-[11px] text-[#8B93A3]">{exercise.name} · {completedSets.length}/{sets.length} 组完成</p></div><button onClick={finish} className="h-10 px-2 text-xs text-[#8B93A3]">退出</button></header>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#151515] p-3">
              <button type="button" onClick={() => onOpenExerciseModal(exercise)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl" aria-label={`${exercise.name} 动作详情`}><ExerciseCover exercise={exercise} /></button>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{exercise.name}</p><p className="mt-1 text-[11px] text-[#8B93A3]">总负荷 · {completedSets.reduce((sum, set) => sum + Number(set.weight || 0) * Number(set.reps || 0), 0).toLocaleString()} kg</p></div>
              <span className="text-xs font-bold text-[#9EFF3F]">{completedSets.length}<span className="text-[#8B93A3]">/{sets.length} 组</span></span>
            </div>
            <div className="mt-4 space-y-5 rounded-2xl bg-[#151515] p-4">
              <FeedbackScale label="RIR（力竭前剩余次数）" inputLabel="末组 RIR 0–10" value={feedback.rir} options={feedbackOptions.rir} onChange={(value) => updateFeedback('rir', value)} />
              <FeedbackScale label="左右肌力是否一致" inputLabel="左右差异 0–3" value={feedback.asymmetry} options={feedbackOptions.asymmetry} onChange={(value) => updateFeedback('asymmetry', value)} />
              <FeedbackScale label="不适程度" inputLabel="不适 0–10" value={feedback.discomfort} options={feedbackOptions.discomfort} onChange={(value) => updateFeedback('discomfort', value)} />
              <button onClick={onAskAI} className="w-full border-t border-[#242426] pt-4 text-left text-xs text-[#8B93A3]">告诉 AI 这组的感受或技术问题 →</button>
            </div>
            <div className="mt-auto pt-5">
              <button onClick={continueAfterFeedback} className="h-14 w-full rounded-2xl bg-[#9EFF3F] text-sm font-black text-[#080808] active:scale-[0.98]">{exerciseIndex < exercises.length - 1 ? '完成反馈 · 下一动作 →' : '完成反馈 · 保存训练 →'}</button>
              <div className="mt-3 flex items-center justify-between text-[11px] text-[#8B93A3]"><button onClick={() => goToExercise(exerciseIndex - 1)} disabled={exerciseIndex === 0}>← 返回训练</button><button onClick={continueAfterFeedback}>跳过反馈训练</button></div>
            </div>
          </section>
        ) : (
          <>
            <header className="border-b border-[#242426] px-4 pb-3 pt-[calc(14px+env(safe-area-inset-top))]">
              <div className="flex items-center justify-between gap-3"><button onClick={onExit} aria-label="暂存并返回" className="flex h-10 items-center gap-1 text-sm font-bold"><ChevronLeft size={18} />训练 · 动作 {exerciseIndex + 1}/{exercises.length}</button><button onClick={finish} className="h-10 px-2 text-xs text-[#8B93A3]">退出</button></div>
              <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-[#242426]"><div className="h-full bg-[#9EFF3F]" style={{ width: totalSets ? `${Math.round(completedTotalSets / totalSets * 100)}%` : '0%' }} /></div>
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto px-4 py-3 no-scrollbar">
              <div className="flex items-center gap-3 rounded-2xl bg-[#151515] p-3">
                <button type="button" onClick={() => onOpenExerciseModal(exercise)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl" aria-label={`${exercise.name} 动作详情`}><ExerciseCover exercise={exercise} /></button>
                <div className="min-w-0 flex-1"><h1 className="truncate text-base font-black">{exercise.name}</h1><p className="mt-1 text-[11px] text-[#8B93A3]">{exercise.planWeight || '--'} · {exercise.planSets} × {exercise.planReps}</p></div>
                <button onClick={() => onOpenExerciseModal(exercise)} className="rounded-lg bg-[#1B1B1B] px-2.5 py-2 text-[10px] text-[#D1D5DB]">动作说明</button>
              </div>
              <section className="mt-3 rounded-2xl bg-[#151515] p-4">
                <div className="flex items-center justify-center"><span className="rounded-full bg-[#26351B] px-3 py-1 text-[11px] font-bold text-[#9EFF3F]">第 {currentSetIndex + 1} 组 / 共 {sets.length} 组</span></div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="text-center"><span className="block text-[10px] font-bold text-[#8B93A3]">重量</span><div className="mt-2 flex items-center justify-center gap-2"><button type="button" aria-label="重量减少 2.5 kg" onClick={() => adjustCurrentSet('weight', -2.5)} className="h-8 rounded-lg bg-[#1B1B1B] px-2 text-[10px] text-[#8B93A3]">-2.5</button><input type="number" min="0" step="any" inputMode="decimal" autoFocus aria-label="重量 KG" value={currentSet?.weight ?? ''} onChange={(event) => updateSet(currentSetIndex, 'weight', event.target.value)} className="w-14 bg-transparent text-center text-[34px] font-black leading-none tabular-nums outline-none" /><button type="button" aria-label="重量增加 2.5 kg" onClick={() => adjustCurrentSet('weight', 2.5)} className="h-8 rounded-lg bg-[#1B1B1B] px-2 text-[10px] text-[#8B93A3]">+2.5</button></div><span className="text-xs text-[#8B93A3]">kg</span></div>
                  <div className="text-center"><span className="block text-[10px] font-bold text-[#8B93A3]">次数</span><div className="mt-2 flex items-center justify-center gap-2"><button type="button" aria-label="次数减少 1" onClick={() => adjustCurrentSet('reps', -1)} className="h-8 w-8 rounded-lg bg-[#1B1B1B] text-[10px] text-[#8B93A3]">-1</button><input type="number" min="1" step="1" inputMode="numeric" aria-label="次数" value={currentSet?.reps ?? ''} onChange={(event) => updateSet(currentSetIndex, 'reps', event.target.value)} className="w-12 bg-transparent text-center text-[34px] font-black leading-none tabular-nums outline-none" /><button type="button" aria-label="次数增加 1" onClick={() => adjustCurrentSet('reps', 1)} className="h-8 w-8 rounded-lg bg-[#1B1B1B] text-[10px] text-[#8B93A3]">+1</button></div><span className="text-xs text-[#8B93A3]">次</span></div>
                </div>
                <button onClick={completeSet} disabled={!currentSet || !validWorkoutSet(currentSet)} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#9EFF3F] text-base font-black text-[#080808] active:scale-[0.98] disabled:opacity-35"><Check size={19} />完成本组</button>
              </section>
              <section className="mt-3 rounded-2xl bg-[#151515] p-3" aria-label="全部训练组">
                <h2 className="mb-2 text-[10px] font-bold text-[#8B93A3]">全部训练组</h2>
                <div className="divide-y divide-[#242426]">{sets.map((set, index) => <div key={index} className={`flex min-h-10 items-center gap-3 px-2 text-xs ${index === currentSetIndex ? 'bg-[#26351B]/55 text-[#9EFF3F]' : set.completed ? 'text-[#F5F5F5]' : 'text-[#48484A]'}`}><span className="w-12">第 {index + 1} 组</span><span className="flex-1 font-bold tabular-nums">{set.weight || '--'} kg × {set.reps || '--'}</span><span>{set.completed ? '✓ 完成' : index === currentSetIndex ? '进行中' : '未完成'}</span></div>)}</div>
              </section>
            </main>
            <footer className="grid grid-cols-4 gap-2 border-t border-[#242426] bg-[#0E0E0E]/95 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
              <button onClick={() => goToExercise(exerciseIndex - 1)} disabled={exerciseIndex === 0} className="h-11 rounded-xl bg-[#1B1B1B] text-[11px] font-bold disabled:opacity-35">上一动作</button><button onClick={skipExercise} className="h-11 rounded-xl bg-[#1B1B1B] text-[11px] font-bold">跳过动作</button><button onClick={() => goToExercise(exerciseIndex + 1)} disabled={exerciseIndex === exercises.length - 1} className="h-11 rounded-xl bg-[#1B1B1B] text-[11px] font-bold disabled:opacity-35">下一动作</button><button onClick={finish} className="h-11 rounded-xl bg-[#1B1B1B] text-[11px] font-bold">结束训练</button>
            </footer>
          </>
        )}
      </fieldset>
      {confirmFinish && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-5" role="alertdialog" aria-modal="true" aria-labelledby="finish-title"><div className="w-full max-w-sm rounded-2xl bg-[#1C1C1E] p-5"><h2 id="finish-title" className="text-lg font-bold">{completedTotalSets === 0 ? '还没有完成的训练组' : `还有 ${remaining} 组未完成，确定结束训练吗？`}</h2><p className="mt-3 text-sm text-[#8B93A3]">{completedTotalSets === 0 ? '先完成一组，或暂存草稿返回今日。' : '仅保存已经完成的内容，未完成组不会计入训练记录。'}</p><button autoFocus onClick={() => setConfirmFinish(false)} disabled={isSubmitting} className="mt-5 h-12 w-full rounded-xl bg-[#9EFF3F] font-bold text-[#080808]">继续训练</button>{completedTotalSets > 0 ? <button onClick={() => { setConfirmFinish(false); onFinish(); }} disabled={isSubmitting} className="mt-3 min-h-12 w-full rounded-xl bg-[#2A2A2A] px-3 py-3 text-sm">结束并保存当前完成内容</button> : <button onClick={onExit} className="mt-3 h-12 w-full rounded-xl bg-[#2A2A2A] text-sm">暂存并返回</button>}</div></div>}
    </div>
  );
};

export default WorkoutMode;
