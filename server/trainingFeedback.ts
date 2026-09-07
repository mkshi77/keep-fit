import { TrainingFeedbackPayload } from '../types.js';
import { createPage, findSchemaProperty, NotionDataSource, NotionPage, retrieveDataSource, updatePageProperties } from './notion.js';
import { getTodayWorkoutFromNotion } from './workout.js';

export const TRAINING_FEEDBACK_DATA_SOURCE_ID = 'a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d';

const FEEDBACK_TYPES: Set<string> = new Set([
  'technical_issue',
  'pain_discomfort',
  'fatigue',
  'asymmetry',
  'weight_issue',
  'equipment_issue',
  'recovery_issue',
  'other',
]);

export const validateTrainingFeedbackPayload = (body: unknown): TrainingFeedbackPayload => {
  if (!body || typeof body !== 'object') throw new Error('请求体不能为空');
  const candidate = body as Partial<TrainingFeedbackPayload>;
  if (!candidate.date || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.date)) throw new Error('日期格式无效');
  if (!candidate.type || !FEEDBACK_TYPES.has(candidate.type)) throw new Error('反馈类型无效');
  if (!candidate.raw || typeof candidate.raw !== 'string' || !candidate.raw.trim()) throw new Error('用户原话不能为空');
  if (candidate.raw.length > 4000) throw new Error('用户原话过长');
  if (candidate.exerciseId != null && (typeof candidate.exerciseId !== 'string' || candidate.exerciseId.length > 200)) throw new Error('动作 ID 无效');
  if (candidate.exerciseName != null && (typeof candidate.exerciseName !== 'string' || candidate.exerciseName.length > 200)) throw new Error('动作名称无效');
  if (candidate.bodyPart != null && (typeof candidate.bodyPart !== 'string' || candidate.bodyPart.length > 200)) throw new Error('部位无效');
  if (candidate.summary != null && (typeof candidate.summary !== 'string' || candidate.summary.length > 2000)) throw new Error('AI 总结无效');
  if (candidate.severity != null && (typeof candidate.severity !== 'number' || candidate.severity < 0 || candidate.severity > 10)) throw new Error('严重度超出范围');
  if (candidate.updateTodayExercise != null && typeof candidate.updateTodayExercise !== 'boolean') throw new Error('更新标记无效');
  return candidate as TrainingFeedbackPayload;
};

const feedbackProperties = (schema: NotionDataSource['properties'], payload: TrainingFeedbackPayload): Record<string, unknown> => {
  const props: Record<string, unknown> = {};
  const date = findSchemaProperty(schema, ['日期', 'Date']);
  if (date?.[1].type === 'date') props[date[0]] = { date: { start: payload.date } };

  const exerciseId = findSchemaProperty(schema, ['动作ID', 'exercise_id', 'Exercise ID']);
  if (exerciseId && payload.exerciseId) {
    if (exerciseId[1].type === 'rich_text') props[exerciseId[0]] = { rich_text: [{ text: { content: payload.exerciseId } }] };
    else if (exerciseId[1].type === 'title') props[exerciseId[0]] = { title: [{ text: { content: payload.exerciseId } }] };
  }

  const exerciseName = findSchemaProperty(schema, ['动作名称', '动作名', 'Exercise Name']);
  if (exerciseName && payload.exerciseName) {
    if (exerciseName[1].type === 'rich_text') props[exerciseName[0]] = { rich_text: [{ text: { content: payload.exerciseName } }] };
    else if (exerciseName[1].type === 'title') props[exerciseName[0]] = { title: [{ text: { content: payload.exerciseName } }] };
  }

  const type = findSchemaProperty(schema, ['类型', 'Type']);
  if (type?.[1].type === 'select') props[type[0]] = { select: { name: payload.type } };

  const severity = findSchemaProperty(schema, ['严重度', 'Severity']);
  if (severity?.[1].type === 'number') props[severity[0]] = { number: payload.severity ?? null };

  const bodyPart = findSchemaProperty(schema, ['部位', 'Body Part']);
  if (bodyPart && payload.bodyPart) {
    if (bodyPart[1].type === 'rich_text') props[bodyPart[0]] = { rich_text: [{ text: { content: payload.bodyPart } }] };
    else if (bodyPart[1].type === 'select') props[bodyPart[0]] = { select: { name: payload.bodyPart } };
  }

  const raw = findSchemaProperty(schema, ['用户原话', 'Raw']);
  if (raw?.[1].type === 'rich_text') props[raw[0]] = { rich_text: [{ text: { content: payload.raw } }] };

  const summary = findSchemaProperty(schema, ['AI结构化总结', 'AI Summary']);
  if (summary && payload.summary) {
    if (summary[1].type === 'rich_text') props[summary[0]] = { rich_text: [{ text: { content: payload.summary } }] };
  }

  const source = findSchemaProperty(schema, ['来源', 'Source']);
  if (source?.[1].type === 'select') props[source[0]] = { select: { name: 'ai_chat' } };

  return props;
};

const exerciseFeedbackPatch = (payload: TrainingFeedbackPayload): Record<string, unknown> => {
  const props: Record<string, unknown> = {};
  if (payload.updateTodayExercise && payload.severity != null && (payload.type === 'pain_discomfort' || payload.type === 'asymmetry' || payload.type === 'fatigue')) {
    if (payload.type === 'pain_discomfort') props['不适0-10'] = { number: payload.severity };
    if (payload.type === 'asymmetry') props['左右差异'] = { number: Math.min(Math.round(payload.severity), 3) };
  }
  return props;
};

export const recordTrainingFeedback = async (payload: TrainingFeedbackPayload) => {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error('NOTION_TOKEN 未配置，无法写入训练反馈');
  const dataSourceId = process.env.TRAINING_FEEDBACK_DATA_SOURCE_ID || TRAINING_FEEDBACK_DATA_SOURCE_ID;

  const schema = await retrieveDataSource(dataSourceId, token);
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    throw new Error('Training Feedback 数据源缺少 Notion schema，写入已拒绝');
  }
  const props = feedbackProperties(schema.properties, payload);
  if (Object.keys(props).length === 0) throw new Error('Training Feedback 数据源缺少所有预期属性');
  await createPage(dataSourceId, token, props);

  let exerciseUpdated = false;
  if (payload.updateTodayExercise && payload.exerciseId) {
    const today = await getTodayWorkoutFromNotion(payload.date);
    const match = today.exercises.find((exercise) => exercise.exerciseId === payload.exerciseId);
    const patch = exerciseFeedbackPatch(payload);
    if (match?.notionPageId && Object.keys(patch).length > 0) {
      await updatePageProperties(match.notionPageId, token, patch);
      exerciseUpdated = true;
    }
  }

  return { success: true, exerciseUpdated };
};
