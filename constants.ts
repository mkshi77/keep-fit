
import { Exercise, LevelConfig, DietItem } from './types';

export const DB_KEY = 'FILLUP_2026_V26_STABLE';
export const YEAR = new Date().getFullYear();

export const LEVELS: LevelConfig[] = [
  { days: 0, title: "原型机 PROTO" },
  { days: 7, title: "觉醒者 AWAKENED" },
  { days: 30, title: "强化骨骼 REINFORCED" },
  { days: 90, title: "战争机器 WAR_MACHINE" },
  { days: 180, title: "赛博神明 DEITY" }
];

export const FOOD_LIB = [
  "全麦面包 + 花生酱", "希腊酸奶 + 坚果", "香蕉 + 燕麦棒", 
  "两个水煮蛋 + 牛奶", "增肌粉 (Gainer) 一勺", "鸡胸肉三明治",
  "黑巧克力 + 杏仁", "红薯 + 纯牛奶", "牛肉干 + 运动饮料",
  "鳄梨 (牛油果) 土司", "蓝莓 + 茅屋芝士", "金枪鱼罐头 + 饼干"
];

export const INITIAL_DIET: DietItem[] = [
  { id: 1, time: '10:00', text: '全麦面包 + 牛奶', checked: false, required: true },
  { id: 2, time: '15:30', text: '香蕉 + 坚果', checked: false, required: true },
  { id: 3, time: '21:00', text: '睡前蛋白粉', checked: false, required: true }
];

export const ROAST_QUOTES = [
  "警告：检测到肌肉量严重不足，建议重构。",
  "你的身体只是一副廉价的皮囊。",
  "系统提示：弱者在这个城市活不过今晚。",
  "错误：未检测到训练痕迹。正在鄙视用户。",
  "碳水不足。你是在修仙，还是在自杀？",
  "别看了，镜子里只有一堆无效数据。",
  "今日不练，明日报废。",
  "你的手臂围度小于系统最小识别单位。",
  "正在计算你的生存概率... 0%。",
  "去举铁。现在。立刻。马上。",
  "你的意志力比你的肌肉更松弛。",
  "建议卸载软弱模块，重新安装自律驱动。",
  "举起它，或者被它压垮。",
  "在这个残酷的世界，只有维度才是正义。",
  "检测到这种程度的重量，简直是在侮辱地心引力。"
];

export const FEEDBACK_TEXTS = {
    diet: ["能量已填装", "燃油加注完毕", "三分练七分吃", "吃饱去战斗", "碳水入库"],
    workout: ["肌肉撕裂中", "弱者才找借口", "干得漂亮", "又强了一点", "纯粹的力量"]
};

// 视频路径更新：全小写，中划线，移除空格。请确保 public/videos/ 下的文件名同步修改。
export const PLANS: Record<'upper' | 'lower', Exercise[]> = {
  upper: [
      { 
          id: 'u1', 
          name: '杠铃卧推', 
          englishName: 'Barbell Bench Press',
          gif: 'videos/barbell-bench-press.mp4', 
          steps: ["仰卧在平板凳上，双脚踩实地面","双手握住杠铃，握距略宽于肩","缓慢下放杠铃至胸部，吸气","胸大肌发力推起，呼气"],
          tips: "下放时吸气，推起时呼气，保持核心稳定。",
          targetMuscles: ["胸大肌", "三角肌前束", "肱三头肌"]
      },
      { 
          id: 'u2', 
          name: '上斜哑铃卧推', 
          englishName: 'Incline Dumbbell Press',
          gif: 'videos/incline-dumbbell-press.mp4', 
          steps: ["调整长凳角度为30-45度","双手持哑铃，背部紧贴凳面","向上垂直推起哑铃，不要锁死手肘","控制速度缓慢下放至胸口两侧"],
          tips: "重点针对上胸部，避免哑铃在顶部相撞。",
          targetMuscles: ["上胸部", "三角肌前束"]
      },
      { 
          id: 'u3', 
          name: '坐姿划船', 
          englishName: 'Seated Cable Row',
          gif: 'videos/seated-cable-row.mp4', 
          steps: ["坐在器械上，双脚踩稳，挺胸收腹","背部发力带动双肘向后拉","肩胛骨向中线靠拢，挤压背肌","缓慢还原，保持背部紧绷"],
          tips: "不要过度后仰，保持躯干稳定。",
          targetMuscles: ["背阔肌", "斜方肌", "菱形肌"]
      },
      { 
          id: 'u4', 
          name: '高位下拉', 
          englishName: 'Lat Pulldown',
          gif: 'videos/lat-pulldown.mp4', 
          steps: ["双手宽握横杠，坐稳并踩实地面","背阔肌发力将横杠拉向胸锁骨位置","在底部稍作停顿，感受背肌收缩","缓慢控制回放"],
          tips: "不要用手臂力量生拉硬拽。",
          targetMuscles: ["背阔肌", "大圆肌"]
      }
  ],
  lower: [
      { 
          id: 'l1', 
          name: '杠铃深蹲', 
          englishName: 'Barbell Back Squat',
          gif: 'videos/barbell-back-squat.mp4', 
          steps: ["杠铃置于斜方肌上，双脚与肩同宽","臀部向后坐，膝盖与脚尖方向一致","蹲至大腿与地面平行或略低","发力蹬地，回到起始位置"],
          tips: "腰背保持挺直，防止膝盖内扣。",
          targetMuscles: ["股四头肌", "臀大肌"]
      },
      { 
          id: 'l2', 
          name: '硬拉', 
          englishName: 'Deadlift',
          gif: 'videos/deadlift.mp4', 
          steps: ["双脚与髋同宽，小腿贴近杠铃","挺胸抬头，背部平直，握住杠铃","核心收紧，臀腿发力将杠铃拉起","站直后有控制地放下"],
          tips: "全程保持背部平直，防止腰部受伤。",
          targetMuscles: ["腘绳肌", "臀大肌", "竖脊肌（全身性）"]
      },
      { 
          id: 'l3', 
          name: '哑铃分腿蹲', 
          englishName: 'Dumbbell Split Squat',
          gif: 'videos/dumbbell-split-squat.mp4', 
          steps: ["双手持哑铃，单脚后搁在凳子上","重心放在前脚，垂直向下蹲","前腿膝盖不宜过度超过脚尖","蹬地回位"],
          tips: "保持躯干正直，平衡能力是关键。",
          targetMuscles: ["股四腿肌", "臀大肌", "平衡能力"]
      }
  ]
};

export const DEFAULT_SETS = 4;
