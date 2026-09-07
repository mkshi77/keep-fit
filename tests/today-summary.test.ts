import { describe, expect, it } from 'vitest';
import { getTodaySummary } from '../components/TodaySummary';
import type { TodayWorkout } from '../types';

const workout: TodayWorkout = {
  date: '2026-09-07',
  trainingDay: 'A',
  isRecoveryDay: false,
  source: 'fallback',
  exercises: [
    { exerciseId: 'bench', name: '卧推', planSets: 4, planReps: '8–12' },
    { exerciseId: 'row', name: '划船', planSets: 3, planReps: '10' },
  ],
};

describe('today summary', () => {
  it('summarizes training volume from the current plan', () => {
    expect(getTodaySummary(workout)).toEqual({
      exerciseCount: 2,
      totalSets: 7,
      estimatedMinutes: 21,
      planLabel: 'A 日',
    });
  });

  it('summarizes recovery days without training volume', () => {
    expect(getTodaySummary({ ...workout, isRecoveryDay: true, trainingDay: null, exercises: [] })).toEqual({
      exerciseCount: 0,
      totalSets: 0,
      estimatedMinutes: 0,
      planLabel: 'Recovery',
    });
  });
});
