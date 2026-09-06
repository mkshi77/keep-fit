import { DietItem, ExercisePlan, LevelConfig, TrainingDay } from './types';

export const DB_KEY = 'FILLUP_2026_V26_STABLE';
export const YEAR = new Date().getFullYear();

export const LEVELS: LevelConfig[] = [
  { days: 0, title: '原型机 PROTO' },
  { days: 7, title: '觉醒者 AWAKENED' },
  { days: 30, title: '强化骨骼 REINFORCED' },
  { days: 90, title: '战争机器 WAR_MACHINE' },
  { days: 180, title: '赛博神明 DEITY' },
];

export const FOOD_LIB = [
  '全麦面包 + 花生酱', '希腊酸奶 + 坚果', '香蕉 + 燕麦棒',
  '两个水煮蛋 + 牛奶', '增肌粉 (Gainer) 一勺', '鸡胸肉三明治',
  '黑巧克力 + 杏仁', '红薯 + 纯牛奶', '牛肉干 + 运动饮料',
  '鳄梨 (牛油果) 土司', '蓝莓 + 茅屋芝士', '金枪鱼罐头 + 饼干',
];

export const INITIAL_DIET: DietItem[] = [
  { id: 1, time: '10:00', text: '全麦面包 + 牛奶', checked: false, required: true },
  { id: 2, time: '15:30', text: '香蕉 + 坚果', checked: false, required: true },
  { id: 3, time: '21:00', text: '睡前蛋白粉', checked: false, required: true },
];

export const ROAST_QUOTES = [
  '警告：检测到肌肉量严重不足，建议重构。',
  '你的身体只是一副廉价的皮囊。',
  '系统提示：弱者在这个城市活不过今晚。',
  '错误：未检测到训练痕迹。正在鄙视用户。',
  '碳水不足。你是在修仙，还是在自杀？',
  '别看了，镜子里只有一堆无效数据。',
  '今日不练，明日报废。',
  '你的手臂围度小于系统最小识别单位。',
  '正在计算你的生存概率... 0%。',
  '去举铁。现在。立刻。马上。',
  '你的意志力比你的肌肉更松弛。',
  '建议卸载软弱模块，重新安装自律驱动。',
  '举起它，或者被它压垮。',
  '在这个残酷的世界，只有维度才是正义。',
  '检测到这种程度的重量，简直是在侮辱地心引力。',
];

export const FEEDBACK_TEXTS = {
  diet: ['能量已填装', '燃油加注完毕', '三分练七分吃', '吃饱去战斗', '碳水入库'],
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
