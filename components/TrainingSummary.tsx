import { Check, ChevronRight, Dumbbell } from 'lucide-react';
import React, { useEffect, useRef, useState } from "react";
import { requestWorkoutReview } from "../services/aiApi";
import { saveDailyWorkoutReview } from "../services/aiConversationStore";
import type { WorkoutReviewPayload } from "../types";

interface TrainingSummaryProps {
  summary: WorkoutReviewPayload;
  onClose: () => void;
  onOpenAIChat: () => void;
  onReviewSaved?: () => void;
}

const TrainingSummary: React.FC<TrainingSummaryProps> = ({ summary, onClose, onOpenAIChat, onReviewSaved }) => {
  const [review, setReview] = useState<{ status: "loading" | "ready" | "fallback"; content: string }>({ status: "loading", content: "" });
  const pendingReview = useRef<{ summary: WorkoutReviewPayload; promise: Promise<string> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (pendingReview.current?.summary !== summary) {
      pendingReview.current = { summary, promise: requestWorkoutReview(summary).then(async (content) => {
        await saveDailyWorkoutReview(summary.date, content).catch(() => null);
        onReviewSaved?.();
        return content;
      }) };
    }
    pendingReview.current.promise
      .then((content) => {
        if (!cancelled) setReview({ status: "ready", content });
      })
      .catch(() => {
        if (cancelled) return;
        const completedSets = summary.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0);
        setReview({
          status: "fallback",
          content: `训练已保存。今天完成 ${completedSets} 组，数据已经在身体账本里记账了。下次保持这个节奏，继续稳稳推进。`,
        });
      });
    return () => { cancelled = true; };
  }, [summary, onReviewSaved]);

  const completedSets = summary.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0);
  const plannedSets = summary.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const completedExercises = summary.exercises.filter((exercise) => exercise.sets.some((set) => set.completed));

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#080808]">
      <div className="mx-auto flex min-h-full w-full max-w-[440px] flex-col px-4 pb-[calc(22px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))]">
        <div className="pt-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#9EFF3F] text-[#080808]"><Check size={30} strokeWidth={3} /></div>
          <h1 aria-label="训练已保存" className="mt-3 text-2xl font-black tracking-tight text-[#F5F5F5]">训练完成</h1>
          <p className="mt-1 text-xs text-[#8B93A3]">今天长了一点。</p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#151515] p-3 text-center">
            <p className="text-xl font-black text-[#F5F5F5] tabular-nums">{completedSets} 组</p>
            <p className="mt-1 text-[10px] text-[#8B93A3]">完成组数</p>
          </div>
          <div className="rounded-xl bg-[#151515] p-3 text-center">
            <p className="text-xl font-black text-[#F5F5F5] tabular-nums">{summary.durationMinutes ?? '--'} 分钟</p>
            <p className="mt-1 text-[10px] text-[#8B93A3]">训练时长</p>
          </div>
          <div className="rounded-xl bg-[#151515] p-3 text-center">
            <p className="text-xl font-black text-[#9EFF3F] tabular-nums">{plannedSets ? Math.round(completedSets / plannedSets * 100) : 0}%</p>
            <p className="mt-1 text-[10px] text-[#8B93A3]">计划完成率</p>
          </div>
        </div>

        <section className="mt-3 rounded-2xl bg-[#151515] p-4">
          <div className="flex items-center justify-between"><h2 className="text-[11px] font-bold text-[#9EFF3F]">● AI 教练点评</h2>{review.status === "fallback" && <span className="text-[10px] text-amber-400">离线鼓励</span>}</div>
          {review.status === "loading" && <p className="mt-3 animate-pulse text-xs text-[#8B93A3]">AI 教练正在查看今天的训练数据...</p>}
          {review.status !== "loading" && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#D1D5DB]">{review.content}</p>}
        </section>

        <section className="mt-4">
          <h2 className="mb-2 text-[11px] font-bold text-[#8B93A3]">主要数据</h2>
          <div className="space-y-2">
            {completedExercises.map((exercise) => {
              const completed = exercise.sets.filter((set) => set.completed);
              return (
                <div key={exercise.exerciseId} className="flex items-center gap-3 rounded-xl bg-[#151515] px-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1B1B1B] text-[#8B93A3]"><Dumbbell size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[#F5F5F5]">{exercise.name}</p>
                    <p className="mt-1 truncate text-[10px] text-[#8B93A3]">{completed.length} 组 · {completed.at(-1)?.weight || '--'} kg</p>
                  </div>
                  <ChevronRight size={15} className="text-[#48484A]" />
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
          <button onClick={onClose} className="h-14 rounded-xl bg-[#1B1B1B] text-sm font-bold text-[#F5F5F5] active:scale-[0.98]">返回今日</button>
          <button onClick={onOpenAIChat} className="h-14 rounded-xl bg-[#9EFF3F] text-sm font-black text-[#080808] active:scale-[0.98]">问教练</button>
        </div>
      </div>
    </div>
  );
};

export default TrainingSummary;
