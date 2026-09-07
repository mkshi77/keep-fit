import { describe, expect, it } from 'vitest';
import { completedContent, currentWorkoutSets, makeWorkoutSets, todayActionLabel, validWorkoutSet, workoutProgress } from '../services/workoutFlow';
import { previousTrainingDate } from '../components/CoachInsight';
import { completionProperties } from '../server/workout';
import { loadLocalData } from '../App';
import type { TodayWorkout } from '../types';

const exercise = { exerciseId: 'bench', name: '卧推', planSets: 3, planReps: '8–10', planWeight: '42.5 kg' };
const workout: TodayWorkout = { date: '2026-09-07', trainingDay: 'A', isRecoveryDay: false, source: 'notion', exercises: [exercise] };
const done = { weight: '40', reps: '8', completed: true };

describe('Today and Workout flow', () => {
  it('uses actual plan volume and weight instead of forcing four sets', () => {
    expect(makeWorkoutSets(exercise, { bench: '30' })).toEqual(Array(3).fill({ weight: '42.5', reps: '8', completed: false }));
    expect(currentWorkoutSets(exercise, { bench: [done, done, done, done] })).toHaveLength(3);
    expect(currentWorkoutSets(exercise, { bench: [done] })[1].completed).toBe(false);
  });

  it('shows Start, Continue, Completed and Recovery independently of filled inputs', () => {
    const progress = workoutProgress(workout, { bench: [done] });
    expect(progress).toEqual({ total: 3, completed: 1, remaining: 2 });
    expect(todayActionLabel(workout, false, false, progress)).toBe('开始训练');
    expect(todayActionLabel(workout, false, true, progress)).toBe('继续训练 · 1/3 组');
    expect(todayActionLabel(workout, true, true, progress)).toBe('今日已完成 ✓');
    expect(todayActionLabel({ ...workout, isRecoveryDay: true }, false, false, progress)).toBe('记录恢复日');
  });

  it('excludes unperformed values both in client content and Notion properties', () => {
    const sets = [done, { weight: '80', reps: '12', completed: false }];
    expect(completedContent(sets)[1]).toEqual({ weight: '', reps: '', completed: false });
    expect(completionProperties(sets, {})['第1组重量kg']).toEqual({ number: 40 });
    expect(completionProperties(sets, {})['第2组重量kg']).toEqual({ number: null });
    expect(completionProperties(sets, {})['第2组次数']).toEqual({ number: null });
    expect(sets[1].weight).toBe('80');
  });

  it('requires valid performed values, allowing bodyweight zero', () => {
    expect(validWorkoutSet({ ...done, weight: '0' })).toBe(true);
    for (const weight of ['', '-1', 'Infinity']) expect(validWorkoutSet({ ...done, weight })).toBe(false);
    for (const reps of ['', '0', '1.5', '-2']) expect(validWorkoutSet({ ...done, reps })).toBe(false);
  });

  it('persists today draft metadata and discards it on a new day', () => {
    const data = { lastLogin: new Date().toDateString(), currentSession: { bench: [done] }, workoutStartedAt: 123, currentExerciseId: 'bench', submissionId: 'retry' };
    expect(loadLocalData(JSON.stringify(data))).toMatchObject({
      ...data,
      lastLogin: new Date().toDateString(),
    });
    expect(loadLocalData(JSON.stringify({ ...data, lastLogin: 'yesterday' }))).toMatchObject({ currentSession: {}, workoutStartedAt: undefined, currentExerciseId: undefined, submissionId: undefined });
  });

  it('keeps a draft by the server business date even when the device login date changed', () => {
    const data = {
      lastLogin: 'device-yesterday',
      draftDate: workout.date,
      workoutCache: workout,
      currentSession: { bench: [done] },
      currentFeedback: { bench: { rir: 2 } },
      workoutStartedAt: 123,
      currentExerciseId: 'bench',
      submissionId: 'retry-after-lost-response',
    };
    expect(loadLocalData(JSON.stringify(data))).toMatchObject({
      ...data,
      lastLogin: new Date().toDateString(),
    });
  });

  it('chooses the previous same training day, excluding today and other plans', () => {
    expect(previousTrainingDate(workout, {
      '2026-09-01': { type: 'workout', workoutPlan: 'A' },
      '2026-09-04': { type: 'workout', workoutPlan: 'A' },
      '2026-09-06': { type: 'workout', workoutPlan: 'B' },
      '2026-09-07': { type: 'workout', workoutPlan: 'A' },
    })).toBe('2026-09-04');
  });
});
