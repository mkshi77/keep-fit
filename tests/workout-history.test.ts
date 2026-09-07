import { describe, expect, it } from 'vitest';
import { formatHistoryForAI, type HistoricalExercise, type HistoricalFeedback } from '../server/workoutHistory';

describe('workout history formatting', () => {
  const exercises: HistoricalExercise[] = [
    {
      date: '2026-09-07',
      exerciseId: 'leg_press',
      name: '腿举',
      sets: [{ weight: 80, reps: 10 }, { weight: 85, reps: 8 }],
      rir: 2,
      discomfort: 3,
    },
    {
      date: '2026-09-05',
      exerciseId: 'leg_press',
      name: '腿举',
      sets: [{ weight: 75, reps: 10 }],
    },
    {
      date: '2026-09-07',
      exerciseId: 'smith_flat_bench',
      name: '史密斯平板卧推',
      sets: [{ weight: 40, reps: 10 }],
      rir: 3,
    },
  ];

  const feedback: HistoricalFeedback[] = [
    {
      date: '2026-09-07',
      exerciseId: 'leg_press',
      exerciseName: '腿举',
      type: 'pain_discomfort',
      severity: 4,
      bodyPart: '右膝',
      summary: '右膝不适 4/10',
    },
  ];

  it('formats exercises grouped by date, latest first', () => {
    const result = formatHistoryForAI(exercises, []);
    expect(result).toContain('近 14 天已完成训练记录：');
    expect(result).toContain('2026-09-07');
    expect(result).toContain('2026-09-05');
    // Latest date should appear before older date
    const sep07Index = result.indexOf('2026-09-07');
    const sep05Index = result.indexOf('2026-09-05');
    expect(sep07Index).toBeLessThan(sep05Index);
  });

  it('includes set data and feedback tags', () => {
    const result = formatHistoryForAI(exercises, []);
    expect(result).toContain('80kg×10');
    expect(result).toContain('RIR 2');
    expect(result).toContain('不适 3');
  });

  it('includes training feedback section when present', () => {
    const result = formatHistoryForAI([], feedback);
    expect(result).toContain('近 20 条训练反馈：');
    expect(result).toContain('pain_discomfort');
    expect(result).toContain('严重度:4');
    expect(result).toContain('右膝');
  });

  it('returns empty string when no data', () => {
    expect(formatHistoryForAI([], [])).toBe('');
  });
});
