import type { AppData, ExercisePlan, TodayWorkout, WorkoutSet } from '../types';

export const makeWorkoutSets = (exercise: ExercisePlan, lastWeights: Record<string, string> = {}): WorkoutSet[] =>
  Array.from({ length: exercise.planSets }, () => ({
    weight: exercise.planWeight?.match(/\d+(?:\.\d+)?/)?.[0] || lastWeights[exercise.exerciseId] || '',
    reps: exercise.planReps.match(/\d+/)?.[0] || '10',
    completed: false,
  }));

export const currentWorkoutSets = (exercise: ExercisePlan, session: AppData['currentSession'], lastWeights: Record<string, string> = {}) =>
  makeWorkoutSets(exercise, lastWeights).map((set, index) => session[exercise.exerciseId]?.[index] || set);

export const workoutProgress = (workout: TodayWorkout | null, session: AppData['currentSession']) => {
  const total = (workout?.exercises ?? []).reduce((sum, exercise) => sum + exercise.planSets, 0);
  const completed = (workout?.exercises ?? []).reduce((sum, exercise) =>
    sum + (session[exercise.exerciseId] || []).slice(0, exercise.planSets).filter((set) => set.completed).length, 0);
  return { total, completed, remaining: total - completed };
};

export const todayActionLabel = (workout: TodayWorkout | null, completed: boolean, hasDraft: boolean, progress: ReturnType<typeof workoutProgress>) => {
  if (completed) return '今日已完成 ✓';
  if (workout?.isRecoveryDay) return '记录恢复日';
  return hasDraft ? `继续训练 · ${progress.completed}/${progress.total} 组` : '开始训练';
};

// Keep planned slots for completion accounting, never submit unperformed values.
export const completedContent = (sets: WorkoutSet[]) => sets.map((set) =>
  set.completed ? { ...set } : { weight: '', reps: '', completed: false });

export const validWorkoutSet = (set: WorkoutSet) =>
  set.weight.trim() !== '' && Number.isFinite(Number(set.weight)) && Number(set.weight) >= 0
  && set.reps.trim() !== '' && Number.isInteger(Number(set.reps)) && Number(set.reps) > 0;
