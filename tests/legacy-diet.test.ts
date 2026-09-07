import { describe, expect, it } from 'vitest';
import { loadLocalData } from '../App';
import type { AppData } from '../types';

describe('legacy diet compatibility', () => {
  it('loads old data with current and history diet fields without carrying currentDiet forward', () => {
    const legacyDiet = [{ id: 1, time: '15:30', text: '香蕉 + 坚果', checked: true, required: true }];
    const raw = JSON.stringify({
      lastLogin: new Date().toDateString(),
      history: {
        '2026-09-06': {
          type: 'workout',
          diet: legacyDiet,
          workoutPlan: 'A',
          syncedToNotion: true,
        },
      },
      weightRecords: [],
      lastWeights: {},
      currentDiet: legacyDiet,
      currentSession: {},
      currentFeedback: {},
    });

    const loaded = loadLocalData(raw);

    expect(loaded.history['2026-09-06']?.diet).toEqual(legacyDiet);
    expect(Object.hasOwn(loaded, 'currentDiet')).toBe(false);
  });

  it('creates fresh app data without currentDiet', () => {
    const loaded: AppData = loadLocalData(null);
    expect(Object.hasOwn(loaded, 'currentDiet')).toBe(false);
  });
});
