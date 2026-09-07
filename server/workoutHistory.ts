import { findSchemaProperty, firstBoolean, firstNumber, firstString, NotionPage, queryDataSource, retrieveDataSource } from './notion.js';
import { TRAINING_DATA_SOURCE_ID } from './workout.js';
import { TRAINING_FEEDBACK_DATA_SOURCE_ID } from './trainingFeedback.js';

const MAX_HISTORY_DAYS = 14;
const MAX_FEEDBACK_RECORDS = 20;

const PROPERTY = {
  date: ['日期', 'Date'],
  completed: ['完成', 'Completed'],
  exerciseId: ['动作ID', 'exercise_id', 'Exercise ID'],
  name: ['动作名称', '动作名', '名称'],
  day: ['训练日', '训练日类型'],
  rir: ['末组RIR', 'RIR'],
  asymmetry: ['左右差异', 'Asymmetry'],
  discomfort: ['不适0-10', '不适', 'Discomfort'],
  feedbackDate: ['日期', 'Date'],
  feedbackExerciseId: ['动作ID', 'exercise_id', 'Exercise ID'],
  feedbackExerciseName: ['动作名称', '动作名'],
  feedbackType: ['类型', 'Type'],
  feedbackSeverity: ['严重度', 'Severity'],
  feedbackBodyPart: ['部位', 'Body Part'],
  feedbackSummary: ['AI结构化总结', 'AI Summary'],
} as const;

interface HistoricalSet {
  weight?: number;
  reps?: number;
}

export interface HistoricalExercise {
  date: string;
  exerciseId: string;
  name: string;
  sets: HistoricalSet[];
  rir?: number;
  asymmetry?: number;
  discomfort?: number;
}

export interface HistoricalFeedback {
  date: string;
  exerciseId: string;
  exerciseName: string;
  type: string;
  severity?: number;
  bodyPart?: string;
  summary?: string;
}

const subtractDays = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const buildDateRangeFilter = (schema: Record<string, { type?: string }>, days: number) => {
  const dateProp = findSchemaProperty(schema, [...PROPERTY.date]);
  if (!dateProp || dateProp[1].type !== 'date') return null;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIME_ZONE || 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const cutoff = subtractDays(today, days);
  return { property: dateProp[0], date: { on_or_after: cutoff } };
};

const parseHistoricalSets = (properties: NotionPage['properties']): HistoricalSet[] =>
  Array.from({ length: 4 }, (_, index) => {
    const n = index + 1;
    return {
      weight: firstNumber(properties, [`第${n}组重量kg`]),
      reps: firstNumber(properties, [`第${n}组次数`]),
    };
  }).filter((set) => set.weight != null || set.reps != null);

export const getRecentWorkoutHistory = async (days = MAX_HISTORY_DAYS): Promise<HistoricalExercise[]> => {
  const token = process.env.NOTION_TOKEN;
  if (!token) return [];
  const dataSourceId = process.env.NOTION_TRAINING_DATA_SOURCE_ID || TRAINING_DATA_SOURCE_ID;

  try {
    const schema = await retrieveDataSource(dataSourceId, token);
    const filters: Record<string, unknown>[] = [];
    const dateFilter = buildDateRangeFilter(schema.properties, days);
    if (dateFilter) filters.push(dateFilter);
    const completedProp = findSchemaProperty(schema.properties, [...PROPERTY.completed]);
    if (completedProp?.[1].type === 'checkbox') {
      filters.push({ property: completedProp[0], checkbox: { equals: true } });
    }

    const body = filters.length === 0 ? {}
      : filters.length === 1 ? { filter: filters[0] }
      : { filter: { and: filters } };
    const pages = await queryDataSource(dataSourceId, token, body);
    if (pages.length > 200) pages.length = 200;

    return pages.map((page) => {
      const date = firstString(page.properties, [...PROPERTY.date]) || '';
      const exerciseId = firstString(page.properties, [...PROPERTY.exerciseId]) || '';
      const name = firstString(page.properties, [...PROPERTY.name]) || exerciseId;
      const sets = parseHistoricalSets(page.properties);
      return {
        date,
        exerciseId,
        name,
        sets,
        rir: firstNumber(page.properties, [...PROPERTY.rir]),
        asymmetry: firstNumber(page.properties, [...PROPERTY.asymmetry]),
        discomfort: firstNumber(page.properties, [...PROPERTY.discomfort]),
      };
    }).filter((e) => e.exerciseId && e.date);
  } catch {
    return [];
  }
};

export const getRecentTrainingFeedback = async (limit = MAX_FEEDBACK_RECORDS): Promise<HistoricalFeedback[]> => {
  const token = process.env.NOTION_TOKEN;
  if (!token) return [];
  const dataSourceId = process.env.TRAINING_FEEDBACK_DATA_SOURCE_ID || TRAINING_FEEDBACK_DATA_SOURCE_ID;

  try {
    const schema = await retrieveDataSource(dataSourceId, token);
    if (!schema.properties || Object.keys(schema.properties).length === 0) return [];
    const dateProp = findSchemaProperty(schema.properties, [...PROPERTY.feedbackDate]);
    const body: Record<string, unknown> = {};
    if (dateProp) body.sorts = [{ property: dateProp[0], direction: 'descending' }];
    const pages = await queryDataSource(dataSourceId, token, body);
    if (pages.length > limit) pages.length = limit;

    return pages.map((page) => ({
      date: firstString(page.properties, [...PROPERTY.feedbackDate]) || '',
      exerciseId: firstString(page.properties, [...PROPERTY.feedbackExerciseId]) || '',
      exerciseName: firstString(page.properties, [...PROPERTY.feedbackExerciseName]) || '',
      type: firstString(page.properties, [...PROPERTY.feedbackType]) || '',
      severity: firstNumber(page.properties, [...PROPERTY.feedbackSeverity]),
      bodyPart: firstString(page.properties, [...PROPERTY.feedbackBodyPart]) || undefined,
      summary: firstString(page.properties, [...PROPERTY.feedbackSummary]) || undefined,
    })).filter((f) => f.date && f.exerciseId);
  } catch {
    return [];
  }
};

export const formatHistoryForAI = (
  exercises: HistoricalExercise[],
  feedback: HistoricalFeedback[],
): string => {
  if (exercises.length === 0 && feedback.length === 0) return '';

  const byDate = new Map<string, HistoricalExercise[]>();
  exercises.forEach((e) => {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  });
  const sortedDates = [...byDate.keys()].sort().reverse();

  const lines: string[] = ['近 14 天已完成训练记录：'];
  sortedDates.forEach((date) => {
    const dayExercises = byDate.get(date)!;
    const summary = dayExercises.map((e) => {
      const sets = e.sets.map((s) => `${s.weight ?? '?'}kg×${s.reps ?? '?'}`).join(', ');
      const tags: string[] = [];
      if (e.rir != null) tags.push(`RIR ${e.rir}`);
      if (e.asymmetry != null) tags.push(`差异 ${e.asymmetry}`);
      if (e.discomfort != null) tags.push(`不适 ${e.discomfort}`);
      return `${e.name}(${e.exerciseId}) [${sets}]${tags.length ? ` ${tags.join(' / ')}` : ''}`;
    }).join(' | ');
    lines.push(`  ${date}: ${summary}`);
  });

  if (feedback.length > 0) {
    lines.push('近 20 条训练反馈：');
    feedback.forEach((f) => {
      const parts = [`${f.date} ${f.exerciseName || f.exerciseId} 类型:${f.type}`];
      if (f.severity != null) parts.push(`严重度:${f.severity}`);
      if (f.bodyPart) parts.push(`部位:${f.bodyPart}`);
      if (f.summary) parts.push(f.summary);
      lines.push(`  ${parts.join(' ')}`);
    });
  }

  return lines.join('\n');
};

export const getAIHistoryContext = async (): Promise<string> => {
  try {
    const [exercises, feedback] = await Promise.all([
      getRecentWorkoutHistory(),
      getRecentTrainingFeedback(),
    ]);
    return formatHistoryForAI(exercises, feedback);
  } catch {
    return '';
  }
};
