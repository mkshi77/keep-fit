import { describe, expect, it } from 'vitest';
import { createSessionCookie } from '../server/auth';
import { resetRateLimits } from '../server/rate-limit';
import type { NotionPage, NotionProperty } from '../server/notion';
import {
  completeWorkoutInNotion,
  exerciseCompletionStatus,
  TRAINING_DATA_SOURCE_ID,
  EXERCISE_DATA_SOURCE_ID,
} from '../server/workout';
import aiHandler from '../api/ai/chat';
import todayHandler from '../api/workout/today';
import type { ApiResponse } from '../server/http';

const mockResponse = () => {
  const state: { status?: number; body?: unknown; headers: Record<string, string> } = { headers: {} };
  const response: ApiResponse = {
    setHeader: (name, value) => { state.headers[name] = value; },
    status: (code) => { state.status = code; return response; },
    json: (body) => { state.body = body; return body; },
  };
  return { response, state };
};

const withEnv = async (values: Record<string, string | undefined>, fn: () => Promise<void>) => {
  const saved = new Map(Object.entries(values).map(([key, value]) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const title = (value: string): NotionProperty => ({ type: 'title', title: [{ plain_text: value }] });
const text = (value: string): NotionProperty => ({ type: 'rich_text', rich_text: [{ plain_text: value }] });
const select = (value: string): NotionProperty => ({ type: 'select', select: { name: value } });
const number = (value: number): NotionProperty => ({ type: 'number', number: value });
const checkbox = (value: boolean): NotionProperty => ({ type: 'checkbox', checkbox: value });

describe('PR 1 auth and AI limiting', () => {
  it('fails closed when access password is not configured', async () => {
    await withEnv({ APP_ACCESS_PASSWORD: undefined }, async () => {
      const { response, state } = mockResponse();
      await todayHandler({ method: 'GET', headers: {} }, response);
      expect(state.status).toBe(503);
    });
  });

  it('allows the today API with a valid session cookie', async () => {
    const previous = process.env.NOTION_TOKEN;
    delete process.env.NOTION_TOKEN;
    await withEnv({ APP_ACCESS_PASSWORD: 'test-password' }, async () => {
      const { response, state } = mockResponse();
      await todayHandler({ method: 'GET', headers: { cookie: createSessionCookie('test-password') } }, response);
      expect(state.status).toBe(200);
      expect(state.body).toMatchObject({ source: 'fallback' });
      expect(state.headers['Cache-Control']).toContain('no-store');
    });
    if (previous) process.env.NOTION_TOKEN = previous;
  });

  it('rate limits authenticated AI requests', async () => {
    resetRateLimits();
    await withEnv({ APP_ACCESS_PASSWORD: 'test-password' }, async () => {
      const headers = {
        origin: 'http://localhost.test',
        host: 'localhost.test',
        cookie: createSessionCookie('test-password'),
        'x-forwarded-for': '10.9.8.7',
      };
      let limited = false;
      for (let index = 0; index < 21; index += 1) {
        const { response, state } = mockResponse();
        await aiHandler({
          method: 'POST',
          headers,
          body: { messages: [{ role: 'user', content: 'test' }] },
        }, response);
        if (state.status === 429) {
          limited = true;
          break;
        }
      }
      expect(limited).toBe(true);
      resetRateLimits();
    });
  });
});

describe('workout completion status', () => {
  it('distinguishes skipped, partial and completed exercises', () => {
    expect(exerciseCompletionStatus([
      { weight: '', reps: '', completed: false },
      { weight: '', reps: '', completed: false },
    ], 4)).toBe('skipped');
    expect(exerciseCompletionStatus([
      { weight: '40', reps: '8', completed: true },
      { weight: '', reps: '', completed: false },
    ], 4)).toBe('partial');
    expect(exerciseCompletionStatus([
      { weight: '40', reps: '8', completed: true },
      { weight: '40', reps: '8', completed: true },
    ], 2)).toBe('completed');
  });

  it('writes status, submission id and skips an already-applied retry', async () => {
    const date = '2026-09-07';
    const trainingPage: NotionPage = {
      id: 'execution-row',
      properties: {
        '\u65e5\u671f': { type: 'date', date: { start: date } },
        '\u8bad\u7ec3\u65e5': select('A'),
        '\u52a8\u4f5cID': text('leg_press'),
        '\u987a\u5e8f': number(1),
        '\u8ba1\u5212\u7ec4\u6570': number(2),
        '\u8ba1\u5212\u72b6\u6001': select('\u5f53\u524d\u8ba1\u5212'),
        '\u5b8c\u6210': checkbox(false),
      },
    };
    const libraryPage: NotionPage = {
      id: 'library-row',
      properties: {
        '\u52a8\u4f5cID': text('leg_press'),
        '\u52a8\u4f5c\u540d\u79f0': title('\u817f\u4e3e'),
        '\u5e93\u72b6\u6001': select('\u5f53\u524d\u4e3b\u8ba1\u5212'),
        '\u542f\u7528': checkbox(true),
      },
    };
    const schema = {
      properties: Object.fromEntries([
        ['\u5e93\u72b6\u6001', { type: 'select' }],
        ['\u542f\u7528', { type: 'checkbox' }],
        ['\u65e5\u671f', { type: 'date' }],
        ['\u8bad\u7ec3\u65e5', { type: 'select' }],
        ['\u52a8\u4f5cID', { type: 'rich_text' }],
        ['\u987a\u5e8f', { type: 'number' }],
        ['\u8ba1\u5212\u7ec4\u6570', { type: 'number' }],
        ['\u8ba1\u5212\u72b6\u6001', { type: 'select' }],
        ['\u5b8c\u6210', { type: 'checkbox' }],
        ['\u63d0\u4ea4ID', { type: 'rich_text' }],
        ['\u672b\u7ec4RIR', { type: 'number' }],
        ['\u5de6\u53f3\u5dee\u5f02', { type: 'number' }],
        ['\u4e0d\u90020-10', { type: 'number' }],
        ...Array.from({ length: 4 }, (_, index) => [
          ['\u7b2c' + (index + 1) + '\u7ec4\u91cd\u91cfkg', { type: 'number' }],
          ['\u7b2c' + (index + 1) + '\u7ec4\u6b21\u6570', { type: 'number' }],
        ]).flat(),
      ]),
    };
    const updates: Array<{ id: string; properties: Record<string, unknown> }> = [];
    const originalFetch = global.fetch;
    global.fetch = (async (input: unknown, init?: RequestInit) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, any> : {};
      const path = url.pathname.replace(/^\/v1/, '');
      if (path === '/data_sources/' + TRAINING_DATA_SOURCE_ID) {
        return { ok: true, json: async () => schema };
      }
      if (path === '/data_sources/' + EXERCISE_DATA_SOURCE_ID) {
        return { ok: true, json: async () => schema };
      }
      if (path === '/data_sources/' + TRAINING_DATA_SOURCE_ID + '/query') {
        return { ok: true, json: async () => ({ results: [trainingPage] }) };
      }
      if (path === '/data_sources/' + EXERCISE_DATA_SOURCE_ID + '/query') {
        return { ok: true, json: async () => ({ results: [libraryPage] }) };
      }
      if (path.startsWith('/pages/')) {
        const properties = body.properties as Record<string, unknown>;
        updates.push({ id: path.slice('/pages/'.length), properties });
        for (const [name, value] of Object.entries(properties) as Array<[string, Record<string, unknown>]>) {
          trainingPage.properties[name] = { type: 'rich_text' in value ? 'rich_text' : 'checkbox' in value ? 'checkbox' : 'number', ...value } as NotionProperty;
        }
        return { ok: true, json: async () => trainingPage };
      }
      throw new Error('Unexpected Notion request: ' + url.pathname);
    }) as typeof fetch;

    try {
      await withEnv({ NOTION_TOKEN: 'test-token' }, async () => {
      const exercise = {
        exerciseId: 'leg_press',
        notionPageId: 'execution-row',
        sets: [{ weight: '80', reps: '10', completed: true }, { weight: '', reps: '', completed: false }],
        feedback: { rir: 2, asymmetry: 0 as const, discomfort: 0 },
      };
      await expect(completeWorkoutInNotion({
        date, trainingDay: 'A', submissionId: 'wrong-set-count',
        exercises: [{ ...exercise, sets: [{ weight: '80', reps: '10', completed: true }] }],
      })).rejects.toThrow('必须提交 2 个计划组');
      expect(updates).toHaveLength(0);

      const partial = await completeWorkoutInNotion({
        date, trainingDay: 'A', submissionId: 'submission-1', exercises: [exercise],
      });
      expect(partial.exercises?.[0].status).toBe('partial');
      const completionUpdate = updates.find((update) => '\u5b8c\u6210' in update.properties);
      expect(completionUpdate?.properties['\u5b8c\u6210']).toEqual({ checkbox: false });
      expect(completionUpdate?.properties['\u63d0\u4ea4ID']).toEqual({
        rich_text: [{ text: { content: 'submission-1' } }],
      });

      updates.length = 0;
      const completed = await completeWorkoutInNotion({
        date,
        trainingDay: 'A',
        submissionId: 'submission-2',
        exercises: [{ ...exercise, sets: [{ weight: '80', reps: '10', completed: true }, { weight: '80', reps: '10', completed: true }] }],
      });
      expect(completed.workoutCompleted).toBe(true);
      expect(updates.find((update) => '\u5b8c\u6210' in update.properties)?.properties['\u5b8c\u6210']).toEqual({ checkbox: true });

      updates.length = 0;
      const retry = await completeWorkoutInNotion({
        date, trainingDay: 'A', submissionId: 'submission-2', exercises: [exercise],
      });
      expect(retry.updated).toBe(0);
      expect(retry.workoutCompleted).toBe(true);
      expect(retry.exercises).toEqual([{ exerciseId: 'leg_press', notionPageId: 'execution-row', status: 'completed' }]);
      expect(updates).toHaveLength(0);
    });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
