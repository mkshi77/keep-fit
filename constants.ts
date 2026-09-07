import { ExercisePlan, LevelConfig, TrainingDay } from './types';

export const DB_KEY = 'FILLUP_2026_V26_STABLE';
export const YEAR = new Date().getFullYear();

export const LEVELS: LevelConfig[] = [
  { days: 0, title: '原型机 PROTO' },
  { days: 7, title: '觉醒者 AWAKENED' },
  { days: 30, title: '强化骨骼 REINFORCED' },
  { days: 90, title: '战争机器 WAR_MACHINE' },
  { days: 180, title: '赛博神明 DEITY' },
];

export const FEEDBACK_TEXTS = {
  workout: ['肌肉撕裂中', '弱者才找借口', '干得漂亮', '又强了一点', '纯粹的力量'],
};

const youtubeSearch = (name: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} 中文教学`)}`;

const exercise = (
  exerciseId: string,
  name: string,
  overrides: Partial<ExercisePlan> = {},
): ExercisePlan => ({
  exerciseId,
  name,
  planSets: 4,
  planReps: '8–12',
  planWeight: '按当前基线',
  baseline: '等待 Notion 同步',
  youtube: youtubeSearch(name),
  ...overrides,
});

// Notion 暂时不可用时的只读容灾计划。只为确切匹配的动作复用本地视频；
// barbell_rdl 明确不映射 deadlift.mp4。
export const FALLBACK_PLANS: Record<TrainingDay, ExercisePlan[]> = {
  A: [
    exercise('smith_flat_bench', '史密斯平板卧推'),
    exercise('seated_cable_row', '坐姿绳索划船', { video: '/videos/seated-cable-row.mp4' }),
    exercise('leg_press', '腿举'),
  ],
  B: [
    exercise('lat_pulldown', '高位下拉', { video: '/videos/lat-pulldown.mp4' }),
    exercise('barbell_rdl', '杠铃罗马尼亚硬拉'),
    exercise('lateral_raise', '侧平举'),
  ],
  C: [
    exercise('db_incline_bench', '上斜哑铃卧推', { video: '/videos/incline-dumbbell-press.mp4' }),
    exercise('single_arm_cable_row', '单臂绳索划船'),
    exercise('leg_curl', '腿弯举'),
  ],
};

export const FALLBACK_WEEKLY_SCHEDULE: Partial<Record<number, TrainingDay>> = {
  1: 'A',
  3: 'B',
  5: 'C',
};

export const DEFAULT_SETS = 4;
export const MAX_OFFICIAL_SETS = 4;
