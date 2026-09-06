import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FALLBACK_PLANS } from '../constants';
import type { NotionPage, NotionProperty } from '../server/notion';
import { completionProperties, getFallbackWorkout, joinWorkoutPages, validateCompletionPayload } from '../server/workout';
import { chatCompletionUrl } from '../api/ai/chat';
import todayHandler from '../api/workout/today';
import aiHandler from '../api/ai/chat';
import type { ApiResponse } from '../server/http';

const title = (value: string): NotionProperty => ({ type: 'title', title: [{ plain_text: value }] });
const text = (value: string): NotionProperty => ({ type: 'rich_text', rich_text: [{ plain_text: value }] });
const select = (value: string): NotionProperty => ({ type: 'select', select: { name: value } });
const number = (value: number): NotionProperty => ({ type: 'number', number: value });
const checkbox = (value: boolean): NotionProperty => ({ type: 'checkbox', checkbox: value });

const mockResponse = () => {
  const state: { status?: number; body?: unknown; headers: Record<string, string> } = { headers: {} };
  const response: ApiResponse = {
    setHeader: (name, value) => { state.headers[name] = value; },
    status: (code) => { state.status = code; return response; },
    json: (body) => { state.body = body; return body; },
  };
  return { response, state };
};

const libraryPage = (id: string, name: string): NotionPage => ({
  id: `library-${id}`,
  properties: {
    动作ID: text(id),
    动作名称: title(name),
    库状态: select('当前主计划'),
    启用: checkbox(true),
    当前基线: text('40kg × 10'),
  },
});

const trainingPage = (id: string, order: number, status = '当前计划'): NotionPage => ({
  id: `execution-${id}`,
  properties: {
    日期: { type: 'date', date: { start: '2026-09-07' } },
    训练日: select('A'),
    动作ID: text(id),
    顺序: number(order),
    计划组数: number(4),
    计划次数: text('8-10'),
    计划状态: select(status),
    完成: checkbox(false),
  },
});

describe('A/B/C fallback plan', () => {
  it('contains exactly the nine formal exercise ids', () => {
    expect(Object.fromEntries(Object.entries(FALLBACK_PLANS).map(([day, exercises]) => [day, exercises.map((exercise) => exercise.exerciseId)]))).toEqual({
      A: ['smith_flat_bench', 'seated_cable_row', 'leg_press'],
      B: ['lat_pulldown', 'barbell_rdl', 'lateral_raise'],
      C: ['db_incline_bench', 'single_arm_cable_row', 'leg_curl'],
    });
    expect(FALLBACK_PLANS.B.find((exercise) => exercise.exerciseId === 'barbell_rdl')?.video).toBeUndefined();
  });

  it('uses A on Monday and recovery on Sunday', () => {
    expect(getFallbackWorkout('2026-09-07').trainingDay).toBe('A');
    expect(getFallbackWorkout('2026-09-06').isRecoveryDay).toBe(true);
  });
});

describe('Notion join', () => {
  it('joins by 动作ID, filters retired rows and sorts by 顺序', () => {
    const libraries = [
      libraryPage('smith_flat_bench', '史密斯平板卧推'),
      libraryPage('seated_cable_row', '坐姿绳索划船'),
      libraryPage('leg_press', '腿举'),
    ];
    const workout = joinWorkoutPages('2026-09-07', [
      trainingPage('leg_press', 3),
      trainingPage('smith_flat_bench', 1),
      trainingPage('seated_cable_row', 2),
      trainingPage('retired', 0, '旧计划停用'),
    ], libraries);
    expect(workout.source).toBe('notion');
    expect(workout.trainingDay).toBe('A');
    expect(workout.exercises.map((exercise) => exercise.exerciseId)).toEqual(['smith_flat_bench', 'seated_cable_row', 'leg_press']);
    expect(workout.exercises.every((exercise) => exercise.notionPageId?.startsWith('execution-'))).toBe(true);
  });
});

describe('completion mapping', () => {
  it('writes only the first four sets and all feedback fields', () => {
    const properties = completionProperties([
      { weight: '40', reps: '10', completed: true },
      { weight: '42.5', reps: '9', completed: true },
      { weight: '42.5', reps: '8', completed: true },
      { weight: '40', reps: '10', completed: true },
      { weight: '30', reps: '20', completed: true },
    ], { rir: 2, asymmetry: 1, discomfort: 0 });
    expect(properties).toMatchObject({
      第1组重量kg: { number: 40 }, 第1组次数: { number: 10 },
      第4组重量kg: { number: 40 }, 第4组次数: { number: 10 },
      末组RIR: { number: 2 }, 左右差异: { number: 1 }, '不适0-10': { number: 0 },
    });
    expect(properties).not.toHaveProperty('第5组重量kg');
  });

  it('rejects invalid feedback', () => {
    expect(() => validateCompletionPayload({
      date: '2026-09-07', trainingDay: 'A',
      exercises: [{ exerciseId: 'x', notionPageId: 'page', sets: [], feedback: { asymmetry: 4 } }],
    })).toThrow('左右差异超出范围');
  });
});

describe('provider and PWA boundaries', () => {
  it('normalizes OpenAI-compatible chat endpoints', () => {
    expect(chatCompletionUrl('https://api.deepseek.com')).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(chatCompletionUrl('https://glm.example/v1/')).toBe('https://glm.example/v1/chat/completions');
  });

  it('keeps every /api route network-only in the service worker', () => {
    const source = readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');
    expect(source).toContain("url.pathname.startsWith('/api/')");
    expect(source).toMatch(/startsWith\('\/api\/'\)[\s\S]*respondWith\(fetch\(request\)\)[\s\S]*return/);
  });

  it('returns a fallback response when NOTION_TOKEN is absent', async () => {
    const previous = process.env.NOTION_TOKEN;
    delete process.env.NOTION_TOKEN;
    const { response, state } = mockResponse();
    await todayHandler({ method: 'GET', headers: {} }, response);
    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({ source: 'fallback' });
    expect(state.headers['Cache-Control']).toContain('no-store');
    if (previous) process.env.NOTION_TOKEN = previous;
  });

  it('fails closed without AI configuration while leaving the app route recoverable', async () => {
    const previous = process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER;
    const { response, state } = mockResponse();
    await aiHandler({ method: 'POST', headers: {}, body: { messages: [{ role: 'user', content: '今天练什么？' }] } }, response);
    expect(state.status).toBe(503);
    expect(state.body).toEqual({ error: 'AI 尚未配置' });
    if (previous) process.env.AI_PROVIDER = previous;
  });
});
