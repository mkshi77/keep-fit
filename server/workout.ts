import { FALLBACK_PLANS, FALLBACK_WEEKLY_SCHEDULE, MAX_OFFICIAL_SETS } from '../constants.js';
import {
  ExerciseFeedback,
  TodayExercise,
  TodayWorkout,
  TrainingDay,
  WorkoutCompletionPayload,
  WorkoutCompletionStatus,
  WorkoutSet,
} from '../types.js';
import {
  findSchemaProperty,
  firstBoolean,
  firstNumber,
  firstProperty,
  firstString,
  NotionDataSource,
  NotionPage,
  propertyString,
  queryDataSource,
  retrieveDataSource,
  updatePageProperties,
} from './notion.js';

export const TRAINING_DATA_SOURCE_ID = '416617d0-fe26-4720-9a9c-fdb6a43eeff4';
export const EXERCISE_DATA_SOURCE_ID = 'fe419cb1-2fe6-4bd9-b484-431c151a27e3';

const PROPERTY = {
  date: ['日期', '训练日期', 'Date'],
  day: ['训练日', '训练日类型', '计划日', 'Day'],
  exerciseId: ['动作ID', 'exercise_id', 'Exercise ID'],
  name: ['动作名称', '动作名', '名称', 'Name', '动作'],
  order: ['顺序', 'Order'],
  planSets: ['计划组数', '组数', 'Plan Sets'],
  planReps: ['计划次数', '次数', 'Plan Reps'],
  planWeight: ['计划重量', '计划重量kg', 'Plan Weight'],
  baseline: ['当前基线', '基线', 'Baseline'],
  youtube: ['中文教学', 'YouTube', 'youtube'],
  video: ['本地视频', '视频', 'Video'],
  cover: ['封面', '教学封面', '缩略图', 'Cover'],
  libraryStatus: ['库状态', 'Library Status'],
  enabled: ['启用', 'Enabled'],
  planStatus: ['计划状态', '训练状态', '执行状态', '状态', 'Plan Status'],
  retired: ['旧计划停用'],
  completed: ['完成', 'Completed'],
  submissionId: ['提交ID', 'Submission ID', 'submission_id'],
  rir: ['末组RIR', 'RIR'],
  asymmetry: ['左右差异', 'Asymmetry'],
  discomfort: ['不适0-10', '不适', 'Discomfort'],
} as const;

const isTrainingDay = (value: string): value is TrainingDay => ['A', 'B', 'C'].includes(value.toUpperCase());

export const dateInTimeZone = (timeZone = process.env.APP_TIME_ZONE || 'Asia/Shanghai') =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export const getFallbackWorkout = (date: string, warning?: string): TodayWorkout => {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const trainingDay = FALLBACK_WEEKLY_SCHEDULE[weekday] ?? null;
  return {
    date,
    trainingDay,
    isRecoveryDay: trainingDay === null,
    source: 'fallback',
    exercises: trainingDay ? FALLBACK_PLANS[trainingDay] : [],
    warning,
  };
};

const makePropertyFilter = (
  name: string,
  schema: { type?: string },
  operator: 'equals' | 'does_not_equal',
  value: string | boolean,
) => {
  const type = schema.type;
  if (type === 'checkbox' && typeof value === 'boolean') return { property: name, checkbox: { [operator]: value } };
  if (type === 'date' && typeof value === 'string') return { property: name, date: { [operator]: value } };
  if (['select', 'status', 'rich_text', 'title'].includes(type ?? '') && typeof value === 'string') {
    return { property: name, [type as string]: { [operator]: value } };
  }
  return undefined;
};

const buildTrainingQuery = (schema: NotionDataSource['properties'], date: string) => {
  const filters: Record<string, unknown>[] = [];
  const dateProperty = findSchemaProperty(schema, [...PROPERTY.date]);
  if (dateProperty) {
    const filter = makePropertyFilter(dateProperty[0], dateProperty[1], 'equals', date);
    if (filter) filters.push(filter);
  }
  const retiredProperty = findSchemaProperty(schema, [...PROPERTY.retired]);
  if (retiredProperty?.[1].type === 'checkbox') {
    filters.push({ property: retiredProperty[0], checkbox: { equals: false } });
  }
  const statusProperty = findSchemaProperty(schema, [...PROPERTY.planStatus]);
  if (statusProperty) {
    const filter = makePropertyFilter(statusProperty[0], statusProperty[1], 'does_not_equal', '旧计划停用');
    if (filter) filters.push(filter);
  }
  const orderProperty = findSchemaProperty(schema, [...PROPERTY.order]);
  return {
    ...(filters.length === 1 ? { filter: filters[0] } : filters.length > 1 ? { filter: { and: filters } } : {}),
    ...(orderProperty ? { sorts: [{ property: orderProperty[0], direction: 'ascending' }] } : {}),
  };
};

const buildLibraryQuery = (schema: NotionDataSource['properties']) => {
  const filters: Record<string, unknown>[] = [];
  const statusProperty = findSchemaProperty(schema, [...PROPERTY.libraryStatus]);
  if (statusProperty) {
    const filter = makePropertyFilter(statusProperty[0], statusProperty[1], 'equals', '当前主计划');
    if (filter) filters.push(filter);
  }
  const enabledProperty = findSchemaProperty(schema, [...PROPERTY.enabled]);
  if (enabledProperty) {
    const filter = makePropertyFilter(enabledProperty[0], enabledProperty[1], 'equals', true);
    if (filter) filters.push(filter);
  }
  return filters.length === 1 ? { filter: filters[0] } : filters.length > 1 ? { filter: { and: filters } } : {};
};

const requireSchemaProperty = (
  schema: NotionDataSource['properties'],
  names: readonly string[],
  dataSourceName: string,
) => {
  if (!findSchemaProperty(schema, [...names])) {
    throw new Error(`${dataSourceName} 缺少属性: ${names[0]}`);
  }
};

const isPageForDate = (page: NotionPage, date: string) => {
  const pageDate = firstString(page.properties, [...PROPERTY.date]);
  return !pageDate || pageDate.slice(0, 10) === date;
};

const isActiveTrainingPage = (page: NotionPage) => {
  if (firstBoolean(page.properties, [...PROPERTY.retired]) === true) return false;
  return !Object.values(page.properties).some((property) => propertyString(property).trim() === '旧计划停用');
};

const isActiveLibraryPage = (page: NotionPage) => {
  const status = firstString(page.properties, [...PROPERTY.libraryStatus]);
  const enabled = firstBoolean(page.properties, [...PROPERTY.enabled]);
  return (!status || status === '当前主计划') && enabled !== false;
};

const pageTitle = (page: NotionPage) => {
  const titleProperty = Object.values(page.properties).find((property) => property.type === 'title');
  return propertyString(titleProperty).trim();
};

const preferTrainingPage = (date: string, current: NotionPage, candidate: NotionPage) => {
  const canonicalPrefix = `${date}｜`;
  const currentIsCanonical = pageTitle(current).startsWith(canonicalPrefix);
  const candidateIsCanonical = pageTitle(candidate).startsWith(canonicalPrefix);
  if (currentIsCanonical !== candidateIsCanonical) return candidateIsCanonical ? candidate : current;

  const currentCreated = Date.parse(current.created_time ?? '');
  const candidateCreated = Date.parse(candidate.created_time ?? '');
  if (Number.isFinite(currentCreated) && Number.isFinite(candidateCreated) && currentCreated !== candidateCreated) {
    return candidateCreated > currentCreated ? candidate : current;
  }
  return candidate.id > current.id ? candidate : current;
};

const dedupeTrainingPages = (date: string, pages: NotionPage[]) => {
  const byExerciseId = new Map<string, NotionPage>();
  pages.forEach((page) => {
    const exerciseId = firstString(page.properties, [...PROPERTY.exerciseId]);
    if (!exerciseId) return;
    const existing = byExerciseId.get(exerciseId);
    byExerciseId.set(exerciseId, existing ? preferTrainingPage(date, existing, page) : page);
  });
  return [...byExerciseId.values()];
};

const localVideoByExerciseId: Partial<Record<string, string>> = {
  seated_cable_row: '/videos/seated-cable-row.mp4',
  lat_pulldown: '/videos/lat-pulldown.mp4',
  db_incline_bench: '/videos/incline-dumbbell-press.mp4',
};

const safeVideo = (exerciseId: string, candidate: string) => {
  if (exerciseId === 'barbell_rdl' && /(^|\/)deadlift\.mp4(?:$|\?)/i.test(candidate)) return undefined;
  return candidate || localVideoByExerciseId[exerciseId];
};

const youtubeFor = (name: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} 中文教学`)}`;

const parseSavedSets = (properties: NotionPage['properties']): WorkoutSet[] =>
  Array.from({ length: MAX_OFFICIAL_SETS }, (_, index) => {
    const number = index + 1;
    const weight = firstNumber(properties, [`第${number}组重量kg`]);
    const reps = firstNumber(properties, [`第${number}组次数`]);
    return {
      weight: weight == null ? '' : String(weight),
      reps: reps == null ? '' : String(reps),
      completed: weight != null || reps != null,
    };
  });

const parseSavedFeedback = (properties: NotionPage['properties']): ExerciseFeedback => ({
  rir: firstNumber(properties, [...PROPERTY.rir]),
  asymmetry: firstNumber(properties, [...PROPERTY.asymmetry]) as ExerciseFeedback['asymmetry'],
  discomfort: firstNumber(properties, [...PROPERTY.discomfort]),
});

const hasSavedValues = (sets: WorkoutSet[], feedback: ExerciseFeedback) =>
  sets.some((set) => set.weight || set.reps) || Object.values(feedback).some((value) => value != null);

export const joinWorkoutPages = (
  date: string,
  trainingPages: NotionPage[],
  libraryPages: NotionPage[],
): TodayWorkout => {
  const libraryById = new Map<string, NotionPage>();
  libraryPages.filter(isActiveLibraryPage).forEach((page) => {
    libraryById.set(page.id, page);
    const id = firstString(page.properties, [...PROPERTY.exerciseId]);
    if (id) libraryById.set(id, page);
  });

  const activePages = dedupeTrainingPages(
    date,
    trainingPages.filter((page) => isPageForDate(page, date) && isActiveTrainingPage(page)),
  )
    .sort((a, b) => (firstNumber(a.properties, [...PROPERTY.order]) ?? 999) - (firstNumber(b.properties, [...PROPERTY.order]) ?? 999));

  const exercises = activePages.flatMap<TodayExercise>((trainingPage) => {
    const joinId = firstString(trainingPage.properties, [...PROPERTY.exerciseId]);
    const libraryPage = libraryById.get(joinId);
    if (!libraryPage) return [];
    const exerciseId = firstString(libraryPage.properties, [...PROPERTY.exerciseId]) || joinId;
    if (!exerciseId) return [];
    const name = firstString(libraryPage.properties, [...PROPERTY.name]) || firstString(trainingPage.properties, [...PROPERTY.name]) || exerciseId;
    const videoCandidate = firstString(libraryPage.properties, [...PROPERTY.video]);
    const savedSets = parseSavedSets(trainingPage.properties);
    const savedFeedback = parseSavedFeedback(trainingPage.properties);
    return [{
      exerciseId,
      notionPageId: trainingPage.id,
      name,
      planSets: firstNumber(trainingPage.properties, [...PROPERTY.planSets]) ?? firstNumber(libraryPage.properties, [...PROPERTY.planSets]) ?? 4,
      planReps: firstString(trainingPage.properties, [...PROPERTY.planReps]) || firstString(libraryPage.properties, [...PROPERTY.planReps]) || '8–12',
      planWeight: firstString(trainingPage.properties, [...PROPERTY.planWeight]) || firstString(libraryPage.properties, [...PROPERTY.planWeight]) || undefined,
      baseline: firstString(libraryPage.properties, [...PROPERTY.baseline]) || firstString(trainingPage.properties, [...PROPERTY.baseline]) || undefined,
      youtube: firstString(libraryPage.properties, [...PROPERTY.youtube]) || youtubeFor(name),
      video: safeVideo(exerciseId, videoCandidate),
      cover: firstString(libraryPage.properties, [...PROPERTY.cover]) || undefined,
      completed: firstBoolean(trainingPage.properties, [...PROPERTY.completed]) ?? false,
      submissionId: firstString(trainingPage.properties, [...PROPERTY.submissionId]) || undefined,
      ...(hasSavedValues(savedSets, savedFeedback) ? { savedSets, savedFeedback } : {}),
    }];
  });

  if (activePages.length !== exercises.length) {
    throw new Error('今日训练存在无法与当前动作库匹配的动作');
  }

  const rawDay = activePages.map((page) => firstString(page.properties, [...PROPERTY.day]).toUpperCase()).find(isTrainingDay);
  const trainingDay = rawDay && isTrainingDay(rawDay) ? rawDay : null;
  return {
    date,
    trainingDay,
    isRecoveryDay: activePages.length === 0,
    source: 'notion',
    exercises,
  };
};

export const getTodayWorkoutFromNotion = async (date: string): Promise<TodayWorkout> => {
  const token = process.env.NOTION_TOKEN;
  const trainingDataSourceId = process.env.NOTION_TRAINING_DATA_SOURCE_ID || TRAINING_DATA_SOURCE_ID;
  const exerciseDataSourceId = process.env.NOTION_EXERCISE_DATA_SOURCE_ID || EXERCISE_DATA_SOURCE_ID;
  if (!token) return getFallbackWorkout(date, 'NOTION_TOKEN 未配置，当前显示本地容灾计划');

  try {
    const [trainingSchema, librarySchema] = await Promise.all([
      retrieveDataSource(trainingDataSourceId, token),
      retrieveDataSource(exerciseDataSourceId, token),
    ]);
    requireSchemaProperty(trainingSchema.properties, PROPERTY.date, 'Training Execution');
    requireSchemaProperty(trainingSchema.properties, PROPERTY.day, 'Training Execution');
    requireSchemaProperty(trainingSchema.properties, PROPERTY.exerciseId, 'Training Execution');
    requireSchemaProperty(trainingSchema.properties, PROPERTY.order, 'Training Execution');
    requireSchemaProperty(librarySchema.properties, PROPERTY.exerciseId, 'Exercise Library');
    requireSchemaProperty(librarySchema.properties, PROPERTY.libraryStatus, 'Exercise Library');
    requireSchemaProperty(librarySchema.properties, PROPERTY.enabled, 'Exercise Library');
    const [trainingPages, libraryPages] = await Promise.all([
      queryDataSource(trainingDataSourceId, token, buildTrainingQuery(trainingSchema.properties, date)),
      queryDataSource(exerciseDataSourceId, token, buildLibraryQuery(librarySchema.properties)),
    ]);
    const workout = joinWorkoutPages(date, trainingPages, libraryPages);
    if (!workout.isRecoveryDay && workout.exercises.length === 0) throw new Error('今日训练动作无法与动作库映射');
    return workout;
  } catch (error) {
    console.error('Notion today workout failed', error instanceof Error ? error.message : error);
    return getFallbackWorkout(date, 'Notion 暂时不可用，当前显示本地容灾计划');
  }
};

const requiredPageProperties = (schema: NotionDataSource['properties'], names: string[]) => {
  const found = names.filter((name) => !schema[name]);
  if (found.length) throw new Error(`Training Execution 缺少属性: ${found.join(', ')}`);
};

const numericValue = (value: string | undefined) => {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`无效数字: ${value}`);
  return parsed;
};

export const completionProperties = (sets: WorkoutSet[], feedback: ExerciseFeedback) => {
  const officialSets = sets.slice(0, MAX_OFFICIAL_SETS);
  const properties: Record<string, unknown> = {};
  for (let index = 0; index < MAX_OFFICIAL_SETS; index += 1) {
    const set = officialSets[index]?.completed ? officialSets[index] : undefined;
    properties[`第${index + 1}组重量kg`] = { number: numericValue(set?.weight) };
    properties[`第${index + 1}组次数`] = { number: numericValue(set?.reps) };
  }
  properties['末组RIR'] = { number: feedback.rir ?? null };
  properties['左右差异'] = { number: feedback.asymmetry ?? null };
  properties['不适0-10'] = { number: feedback.discomfort ?? null };
  return properties;
};

export const exerciseCompletionStatus = (sets: WorkoutSet[], planSets: number): WorkoutCompletionStatus => {
  const officialSetCount = Math.min(Math.max(planSets, 1), MAX_OFFICIAL_SETS);
  const completedCount = sets
    .slice(0, officialSetCount)
    .filter((set) => set.completed)
    .length;
  if (completedCount === 0) return 'skipped';
  return completedCount >= officialSetCount ? 'completed' : 'partial';
};

export const validateCompletionPayload = (body: unknown): WorkoutCompletionPayload => {
  if (!body || typeof body !== 'object') throw new Error('请求体不能为空');
  const candidate = body as Partial<WorkoutCompletionPayload>;
  if (!candidate.date || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.date)) throw new Error('日期格式无效');
  if (!candidate.trainingDay || !isTrainingDay(candidate.trainingDay)) throw new Error('训练日必须是 A、B 或 C');
  if (candidate.submissionId != null && (typeof candidate.submissionId !== 'string' || candidate.submissionId.length > 100)) {
    throw new Error('提交 ID 无效');
  }
  if (!Array.isArray(candidate.exercises) || candidate.exercises.length === 0) throw new Error('至少提交一个动作');
  const seenPages = new Set<string>();
  candidate.exercises.forEach((exercise) => {
    if (!exercise.exerciseId || !exercise.notionPageId || !Array.isArray(exercise.sets) || !exercise.feedback || typeof exercise.feedback !== 'object') throw new Error('动作提交数据不完整');
    if (seenPages.has(exercise.notionPageId)) throw new Error('动作提交数据重复');
    seenPages.add(exercise.notionPageId);
    exercise.sets.forEach((set) => {
      if (!set || typeof set !== 'object' || typeof set.weight !== 'string' || typeof set.reps !== 'string' || typeof set.completed !== 'boolean') throw new Error('组数据格式无效');
      numericValue(set.weight);
      numericValue(set.reps);
    });
    if (exercise.feedback?.rir != null && (exercise.feedback.rir < 0 || exercise.feedback.rir > 10)) throw new Error('RIR 超出范围');
    if (exercise.feedback?.asymmetry != null && ![0, 1, 2, 3].includes(exercise.feedback.asymmetry)) throw new Error('左右差异超出范围');
    if (exercise.feedback?.discomfort != null && (exercise.feedback.discomfort < 0 || exercise.feedback.discomfort > 10)) throw new Error('不适评分超出范围');
  });
  return candidate as WorkoutCompletionPayload;
};

export const completeWorkoutInNotion = async (payload: WorkoutCompletionPayload) => {
  const token = process.env.NOTION_TOKEN;
  const trainingDataSourceId = process.env.NOTION_TRAINING_DATA_SOURCE_ID || TRAINING_DATA_SOURCE_ID;
  if (!token) throw new Error('NOTION_TOKEN 未配置，训练草稿尚未正式写入');

  const [schema, today] = await Promise.all([
    retrieveDataSource(trainingDataSourceId, token),
    getTodayWorkoutFromNotion(payload.date),
  ]);
  if (today.source !== 'notion') throw new Error('Notion 今日计划不可用，无法安全写回');
  requiredPageProperties(schema.properties, [
    '第1组重量kg', '第1组次数', '第2组重量kg', '第2组次数',
    '第3组重量kg', '第3组次数', '第4组重量kg', '第4组次数',
    '末组RIR', '左右差异', '不适0-10', '完成',
  ]);

  const todayByPage = new Map(today.exercises.map((exercise) => [exercise.notionPageId, exercise]));
  const statuses: Array<{ exerciseId: string; notionPageId: string; status: WorkoutCompletionStatus }> = [];
  for (const exercise of payload.exercises) {
    const planned = todayByPage.get(exercise.notionPageId);
    if (planned?.exerciseId !== exercise.exerciseId) {
      throw new Error(`动作 ${exercise.exerciseId} 不属于今日有效计划`);
    }
    if (payload.submissionId && planned.submissionId === payload.submissionId) continue;
    statuses.push({
      exerciseId: exercise.exerciseId,
      notionPageId: exercise.notionPageId,
      status: exerciseCompletionStatus(exercise.sets, planned.planSets),
    });
  }

  // 先写训练数据；任一动作失败时不会标记任何动作完成，因此可以直接重试。
  await Promise.all(statuses.map((status) => {
    const exercise = payload.exercises.find((item) => item.notionPageId === status.notionPageId)!;
    return updatePageProperties(status.notionPageId, token, completionProperties(exercise.sets, exercise.feedback));
  }));

  // 再写完成标记。partial / skipped 明确保持未完成，避免单组完成被放大成整日完成。
  const submissionProperty = findSchemaProperty(schema.properties, [...PROPERTY.submissionId]);
  await Promise.all(statuses.map((status) => {
    const properties: Record<string, unknown> = { 完成: { checkbox: status.status === 'completed' } };
    if (submissionProperty && payload.submissionId && submissionProperty[1].type === 'rich_text') {
      properties[submissionProperty[0]] = { rich_text: [{ text: { content: payload.submissionId } }] };
    }
    return updatePageProperties(status.notionPageId, token, properties);
  }));

  const workoutCompleted = statuses.length > 0
    && statuses.every((status) => status.status === 'completed')
    && statuses.length === today.exercises.length;
  return {
    success: true,
    updated: statuses.length,
    submissionId: payload.submissionId ?? null,
    workoutCompleted,
    exercises: statuses,
  };
};

