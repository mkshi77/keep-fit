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
          content: `训练已保存 💪 今天完成 ${completedSets} 组，数据已经在身体账本里记账了。下次保持这个节奏，继续稳稳推进！🔥`,
        });
      });
    return () => { cancelled = true; };
  }, [summary, onReviewSaved]);

  const completedSets = summary.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0);
  const plannedSets = summary.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const completedExercises = summary.exercises.filter((exercise) => exercise.sets.some((set) => set.completed));

  return (
    <div className="fixed inset-0 z-[200] bg-black overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[520px] flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]">
        <div className="pt-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/25 bg-[#a4ff4f]/10 text-2xl">✅</div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">训练已保存</h1>
          <p className="mt-2 text-xs text-gray-500">今天长了一点。</p>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-[#111] p-4">
            <p className="text-xs text-gray-400">完成组数</p>
            <p className="mt-2 text-2xl font-bold text-white">{completedSets}</p>
          </div>
          <div className="rounded-2xl bg-[#111] p-4">
            <p className="text-xs text-gray-400">时长 / 分钟</p>
            <p className="mt-2 text-2xl font-bold text-white">{summary.durationMinutes ?? '--'}</p>
          </div>
          <div className="rounded-2xl bg-[#111] p-4">
            <p className="text-xs text-gray-400">计划完成</p>
            <p className="mt-2 text-2xl font-bold text-white">{plannedSets ? Math.round(completedSets / plannedSets * 100) : 0}%</p>
          </div>
        </div>

        <section className="mt-5 rounded-2xl bg-[#111] p-4">
          <h2 className="text-[10px] font-bold tracking-widest text-gray-500">动作明细 · RIR / 不适</h2>
          <div className="mt-3 space-y-3">
            {completedExercises.map((exercise) => {
              const completed = exercise.sets.filter((set) => set.completed);
              return (
                <div key={exercise.exerciseId} className="rounded-xl bg-[#151515] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white">{exercise.name}</p>
                    <span className="text-xs font-bold text-[#a4ff4f]">{completed.length} 组</span>
                  </div>
                  <p className="mt-2 font-mono text-xs text-gray-300">
                    {completed.map((set) => [set.weight || "-", set.reps || "-"].join("kg × ")).join(" / ")} reps
                  </p>
                  <p className="mt-2 text-[11px] text-gray-500">
                    RIR {exercise.feedback.rir ?? "--"} · 不适 {exercise.feedback.discomfort ?? "--"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-[#111] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold tracking-widest text-gray-500">AI 复盘</h2>
            {review.status === "fallback" && <span className="text-[10px] text-orange-400">离线鼓励</span>}
          </div>
          {review.status === "loading" && <p className="mt-3 animate-pulse text-sm text-gray-400">AI 教练正在查看今天的训练数据...</p>}
          {review.status !== "loading" && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{review.content}</p>}
        </section>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onOpenAIChat} className="h-12 rounded-xl border border-accent bg-[#a4ff4f] text-sm font-black text-black active:scale-95">查看 AI 对话</button>
          <button onClick={onClose} className="h-12 rounded-xl border border-[#333] bg-[#151515] text-sm font-bold text-gray-300 active:scale-95">返回今日</button>
        </div>
      </div>
    </div>
  );
};

export default TrainingSummary;
