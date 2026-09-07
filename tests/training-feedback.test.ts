import { describe, expect, it } from 'vitest';
import { validateTrainingFeedbackPayload } from '../server/trainingFeedback';

const validPayload = {
  date: '2026-09-07',
  type: 'pain_discomfort' as const,
  severity: 4,
  bodyPart: '右膝',
  exerciseId: 'leg_press',
  exerciseName: '腿举',
  raw: '腿举右膝不舒服，大概 4/10',
  summary: '右膝不适 4/10',
  updateTodayExercise: true,
};

describe('Training Feedback payload validation', () => {
  it('accepts a valid pain/discomfort payload', () => {
    const result = validateTrainingFeedbackPayload(validPayload);
    expect(result.type).toBe('pain_discomfort');
    expect(result.severity).toBe(4);
    expect(result.raw).toContain('腿举');
  });

  it('accepts payload without optional fields', () => {
    const result = validateTrainingFeedbackPayload({ date: '2026-09-07', type: 'other', raw: '今天感觉还好' });
    expect(result.type).toBe('other');
    expect(result.severity).toBeUndefined();
  });

  it('rejects invalid date format', () => {
    expect(() => validateTrainingFeedbackPayload({ ...validPayload, date: '2026/09/07' })).toThrow('日期格式无效');
  });

  it('rejects invalid feedback type', () => {
    expect(() => validateTrainingFeedbackPayload({ ...validPayload, type: 'unknown_type' })).toThrow('反馈类型无效');
  });

  it('rejects missing raw text', () => {
    expect(() => validateTrainingFeedbackPayload({ ...validPayload, raw: '' })).toThrow('用户原话不能为空');
  });

  it('rejects severity out of range', () => {
    expect(() => validateTrainingFeedbackPayload({ ...validPayload, severity: 11 })).toThrow('严重度超出范围');
    expect(() => validateTrainingFeedbackPayload({ ...validPayload, severity: -1 })).toThrow('严重度超出范围');
  });
});

describe('AI action proposal parsing', () => {
  const ACTION_BLOCK_RE = /```action\s*\n([\s\S]*?)```/;

  it('extracts a valid action block from AI reply', () => {
    const reply = '了解你的情况。\n```action\n{"action":"record_training_feedback","type":"pain_discomfort","severity":4,"bodyPart":"右膝","exerciseId":"leg_press","exerciseName":"腿举","raw":"腿举右膝不舒服，大概 4/10","summary":"右膝不适 4/10","updateTodayExercise":true}\n```';
    const match = reply.match(ACTION_BLOCK_RE);
    expect(match).toBeTruthy();
    const parsed = JSON.parse(match![1]);
    expect(parsed.action).toBe('record_training_feedback');
    expect(parsed.severity).toBe(4);
    expect(parsed.bodyPart).toBe('右膝');
  });

  it('strips the action block from display content', () => {
    const reply = '了解你的情况。\n```action\n{"action":"record_training_feedback","type":"pain_discomfort","severity":4,"raw":"膝不适"}\n```';
    const clean = reply.replace(ACTION_BLOCK_RE, '').trim();
    expect(clean).toBe('了解你的情况。');
    expect(clean).not.toContain('action');
  });

  it('does not extract action block without the fence', () => {
    const reply = '没有提案的普通回复。';
    expect(reply.match(ACTION_BLOCK_RE)).toBeNull();
  });
});
