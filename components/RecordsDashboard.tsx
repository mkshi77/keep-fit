import { UserRound } from 'lucide-react';
import React from 'react';
import type { HistoryRecord, WeightRecord } from '../types';
import StatsOverview from './StatsOverview';
import WeightChart from './WeightChart';

interface RecordsDashboardProps {
  history: Record<string, HistoryRecord>;
  weightRecords: WeightRecord[];
  onAddWeight: () => void;
  onDateClick: (date: string, record?: HistoryRecord) => void;
}

const RecordsDashboard: React.FC<RecordsDashboardProps> = ({ history, weightRecords, onAddWeight, onDateClick }) => {
  const [period, setPeriod] = React.useState<'week' | 'month' | 'quarter' | 'all'>('week');
  const periodLabels = { week: '本周', month: '本月', quarter: '3个月', all: '全部' } as const;
  const periodStart = React.useMemo(() => {
    if (period === 'all') return null;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (period === 'month') start.setDate(1);
    if (period === 'quarter') start.setMonth(start.getMonth() - 2, 1);
    return start;
  }, [period]);
  const filteredHistory = Object.fromEntries(Object.entries(history).filter(([date]) => !periodStart || new Date(`${date}T12:00:00`) >= periodStart));
  const records = Object.entries(filteredHistory).filter(([, record]) => record.type === 'workout');
  const completedSets = records.reduce((total, [, record]) => total + Object.values(record.workoutSession ?? {}).flat().filter((set) => set.completed).length, 0);
  const feedback = records.flatMap(([, record]) => Object.values(record.workoutFeedback ?? {}));
  const rirValues = feedback.flatMap((item) => item.rir == null ? [] : [item.rir]);
  const averageRir = rirValues.length ? rirValues.reduce((total, rir) => total + rir, 0) / rirValues.length : 0;
  const discomfortCount = feedback.filter((item) => (item.discomfort ?? 0) > 0).length;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-[440px] px-4 pb-[calc(92px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))]">
      <header className="flex items-center justify-between"><h1 className="text-[28px] font-black tracking-tight">记录</h1><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#151515] text-[#8B93A3]"><UserRound size={18} /></span></header>
      <div className="mt-3 grid h-10 grid-cols-4 rounded-xl bg-[#151515] p-1 text-[11px] font-bold text-[#8B93A3]">
        {(Object.keys(periodLabels) as Array<keyof typeof periodLabels>).map((key) => (
          <button key={key} type="button" onClick={() => setPeriod(key)} className={`rounded-lg transition-colors ${period === key ? 'bg-[#F5F5F5] text-[#080808]' : ''}`} aria-pressed={period === key}>{periodLabels[key]}</button>
        ))}
      </div>

      <section className="mt-3 rounded-2xl bg-[#151515] p-4">
        <p className="text-[10px] font-bold text-[#8B93A3]">{periodLabels[period]}训练</p>
        <div className="mt-2 flex items-end gap-2"><span className="text-3xl font-black tabular-nums">{records.length} 次</span><span className="pb-1 text-[10px] font-bold text-[#9EFF3F]">稳定积累</span></div>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[#242426] pt-3">
          <div><dt className="text-[10px] text-[#8B93A3]">完成组数</dt><dd className="mt-1 text-lg font-black tabular-nums">{completedSets}</dd></div>
          <div><dt className="text-[10px] text-[#8B93A3]">训练天数</dt><dd className="mt-1 text-lg font-black tabular-nums">{records.length}</dd></div>
          <div><dt className="text-[10px] text-[#8B93A3]">完成率</dt><dd className="mt-1 text-lg font-black text-[#9EFF3F]">{records.length ? '100%' : '--'}</dd></div>
        </dl>
      </section>

      <section className="mt-3 overflow-hidden rounded-2xl bg-[#151515] p-1"><div className="px-3 pt-3 text-[11px] font-bold">力量与体重趋势</div><WeightChart records={weightRecords} onAddWeight={onAddWeight} /></section>

      <section className="mt-3 rounded-2xl bg-[#151515] p-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-bold">训练质量</h2><span className="rounded-full bg-[#26351B] px-2 py-1 text-[10px] text-[#9EFF3F]">持续优化</span></div>
        <dl className="mt-3 grid grid-cols-3 gap-2"><div><dt className="text-[10px] text-[#8B93A3]">平均 RIR</dt><dd className="mt-1 text-lg font-black tabular-nums">{averageRir.toFixed(1)}</dd></div><div><dt className="text-[10px] text-[#8B93A3]">反馈动作</dt><dd className="mt-1 text-lg font-black">{feedback.length}</dd></div><div><dt className="text-[10px] text-[#8B93A3]">不适记录</dt><dd className="mt-1 text-lg font-black">{discomfortCount}</dd></div></dl>
      </section>

      <section className="mt-3"><h2 className="mb-2 text-[11px] font-bold text-[#8B93A3]">训练日历</h2><StatsOverview history={filteredHistory} onDateClick={onDateClick} /></section>
    </main>
  );
};

export default RecordsDashboard;
