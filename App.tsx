import React, { useCallback, useEffect, useState } from 'react';
import { DB_KEY, FALLBACK_PLANS, FALLBACK_WEEKLY_SCHEDULE, FEEDBACK_TEXTS } from './constants';
import type {
  AppData,
  ExerciseFeedback,
  ExercisePlan,
  FeedbackItem,
  HistoryRecord,
  ModalType,
  ToastState,
  TodayWorkout,
  TrainingDay,
  WorkoutSet,
  WorkoutReviewPayload,
} from './types';
import Header from './components/Header';
import WeightChart from './components/WeightChart';
import StatsOverview from './components/StatsOverview';
import WorkoutSection from './components/WorkoutSection';
import WorkoutMode from './components/WorkoutMode';
import TodaySummary from './components/TodaySummary';
import AIChat from './components/AIChat';
import TrainingSummary from './components/TrainingSummary';
import Toast from './components/Toast';
import FeedbackLayer from './components/FeedbackLayer';
import ExerciseModal from './components/ExerciseModal';
import DataManagement from './components/DataManagement';
import { WeightModal, ActionSheet, HistoryModal, CelebrationLayer } from './components/Modals';
import { completeWorkout, getTodayWorkout } from './services/workoutApi';
import { checkSession } from './services/authApi';
import AuthGate from './components/AuthGate';

const dateKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const todayLoginKey = () => new Date().toDateString();

const INITIAL_DATA: AppData = {
  lastLogin: '',
  history: {},
  weightRecords: [],
  lastWeights: {},
  currentSession: {},
  currentFeedback: {},
};

const migrateHistory = (history: unknown): Record<string, HistoryRecord> => {
  if (!history || typeof history !== 'object') return {};
  return Object.fromEntries(Object.entries(history as Record<string, Record<string, unknown>>).map(([date, record]) => {
    const oldPlan = record.workoutPlan;
    const workoutPlan = oldPlan === 'A' || oldPlan === 'B' || oldPlan === 'C' ? oldPlan : null;
    return [date, { ...record, workoutPlan } as HistoryRecord];
  }));
};

export const loadLocalData = (raw: string | null): AppData => {
  if (!raw) return { ...INITIAL_DATA, lastLogin: todayLoginKey() };
  try {
    const saved = JSON.parse(raw) as Partial<AppData> & Record<string, unknown>;
    delete saved.currentDiet;
    const sameDay = saved.lastLogin === todayLoginKey();
    return {
      ...INITIAL_DATA,
      ...saved,
      history: migrateHistory(saved.history),
      lastLogin: todayLoginKey(),
      currentSession: sameDay ? (saved.currentSession || {}) : {},
      currentFeedback: sameDay ? (saved.currentFeedback || {}) : {},
      workoutCache: saved.workoutCache?.date === dateKey() ? saved.workoutCache : undefined,
    };
  } catch {
    return { ...INITIAL_DATA, lastLogin: todayLoginKey() };
  }
};

const clientFallback = (warning: string): TodayWorkout => {
  const today = dateKey();
  const day = FALLBACK_WEEKLY_SCHEDULE[new Date(`${today}T12:00:00`).getDay()] ?? null;
  return {
    date: today,
    trainingDay: day,
    isRecoveryDay: day === null,
    source: 'fallback',
    exercises: day ? FALLBACK_PLANS[day] : [],
    warning,
  };
};

const App: React.FC = () => {
  const [appData, setAppData] = useState<AppData>(INITIAL_DATA);
  const [workout, setWorkout] = useState<TodayWorkout | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isWorkoutLoading, setIsWorkoutLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'records' | 'coach'>('today');
  const [modal, setModal] = useState<ModalType>('none');
  const [modalData, setModalData] = useState<Record<string, unknown> | ExercisePlan | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isWorkoutMode, setIsWorkoutMode] = useState(false);
  const [workoutStartedAt, setWorkoutStartedAt] = useState<number | null>(null);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutReviewPayload | null>(null);
  const [reviewToken, setReviewToken] = useState(0);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ show: true, message, type });
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(DB_KEY);
    const saved = loadLocalData(raw);
    setAppData(saved);
    if (saved.workoutCache) setWorkout(saved.workoutCache);
    setIsLoaded(true);
    if (!raw) {
      const timer = window.setTimeout(() => setModal('weight'), 800);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) localStorage.setItem(DB_KEY, JSON.stringify(appData));
  }, [appData, isLoaded]);

  useEffect(() => {
    let cancelled = false;
    checkSession()
      .then(() => { if (!cancelled) setIsAuthenticated(true); })
      .catch(() => { if (!cancelled) setIsAuthenticated(false); });
    return () => { cancelled = true; };
  }, []);

  const syncWorkout = useCallback(async () => {
    setIsWorkoutLoading(true);
    try {
      const latest = await getTodayWorkout();
      setWorkout(latest);
      setAppData((previous) => {
        const hasDraft = Object.values(previous.currentSession).some((sets) => sets.some((set) => set.weight || set.reps || set.completed));
        const savedSession = latest.exercises.reduce<Record<string, WorkoutSet[]>>((result, exercise) => {
          if (exercise.savedSets) result[exercise.exerciseId] = exercise.savedSets;
          return result;
        }, {});
        const currentSession = hasDraft ? previous.currentSession : savedSession;
        const hasFeedbackDraft = Object.values(previous.currentFeedback).some((item) => Object.values(item).some((value) => value != null));
        const savedFeedback = latest.exercises.reduce<Record<string, ExerciseFeedback>>((result, exercise) => {
          if (exercise.savedFeedback) result[exercise.exerciseId] = exercise.savedFeedback;
          return result;
        }, {});
        const currentFeedback = hasFeedbackDraft ? previous.currentFeedback : savedFeedback;
        const allCompleted = latest.source === 'notion' && latest.exercises.length > 0 && latest.exercises.every((exercise) => exercise.completed);
        const history = { ...previous.history };
        if (allCompleted && !history[latest.date]) {
          history[latest.date] = {
            type: 'workout',
            workoutPlan: latest.trainingDay,
            workoutSession: currentSession,
            workoutFeedback: currentFeedback,
            syncedToNotion: true,
          };
        }
        return { ...previous, workoutCache: latest, currentSession, currentFeedback, history };
      });
      if (latest.warning) showToast(latest.warning, 'info');
    } catch (error) {
      const fallback = clientFallback(error instanceof Error ? error.message : '今日训练同步失败');
      setWorkout((current) => current || fallback);
      setAppData((previous) => ({ ...previous, workoutCache: previous.workoutCache || fallback }));
      showToast('无法连接训练 API，已启用本地容灾计划', 'error');
    } finally {
      setIsWorkoutLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isLoaded && isAuthenticated) void syncWorkout();
  }, [isLoaded, isAuthenticated, syncWorkout]);

  const triggerFeedback = useCallback((x: number, y: number, type: 'workout') => {
    const texts = FEEDBACK_TEXTS[type];
    const item = { id: Date.now(), x, y, text: texts[Math.floor(Math.random() * texts.length)], color: '#00ccff' };
    setFeedbacks((previous) => [...previous, item]);
    window.setTimeout(() => setFeedbacks((previous) => previous.filter((entry) => entry.id !== item.id)), 2500);
  }, []);

  const handleSessionChange = (currentSession: Record<string, WorkoutSet[]>, exerciseId?: string, weight?: string) => {
    if (Object.values(currentSession).some((sets) => sets.some((set) => set.completed))) {
      setWorkoutStartedAt((previous) => previous ?? Date.now());
    }
    setAppData((previous) => ({
      ...previous,
      currentSession,
      lastWeights: exerciseId && weight ? { ...previous.lastWeights, [exerciseId]: weight } : previous.lastWeights,
    }));
  };

  const handleFeedbackChange = (exerciseId: string, feedback: ExerciseFeedback) => {
    setAppData((previous) => ({ ...previous, currentFeedback: { ...previous.currentFeedback, [exerciseId]: feedback } }));
  };

  const checkFilledToday = () => Boolean(appData.history[dateKey()]);

  const finishLocally = (weightValue: string, type: 'rest' | 'workout', syncedToNotion: boolean, summary?: WorkoutReviewPayload) => {
    const currentDate = dateKey();
    const weightRecords = [...appData.weightRecords];
    if (weightValue) {
      weightRecords.push({ date: currentDate, val: weightValue });
      if (weightRecords.length > 30) weightRecords.shift();
    }
    const history = { ...appData.history };
    history[currentDate] = {
      type,
      workoutPlan: type === 'workout' ? workout?.trainingDay ?? null : null,
      workoutSession: type === 'workout' ? appData.currentSession : undefined,
      workoutFeedback: type === 'workout' ? appData.currentFeedback : undefined,
      syncedToNotion,
    };
    setAppData((previous) => ({
      ...previous,
      history,
      weightRecords,
      currentSession: type === 'workout' ? {} : previous.currentSession,
      currentFeedback: type === 'workout' ? {} : previous.currentFeedback,
    }));
    setModalData({ type });
    if (type === 'workout' && summary) {
      setModal('none');
      setWorkoutSummary(summary);
    } else {
      setModal('celebration');
    }
  };

  const confirmFinishDay = async (weightValue: string, overrideIsRestDay?: boolean) => {
    const isRestDay = overrideIsRestDay ?? Boolean((modalData as { isRestDay?: boolean } | null)?.isRestDay);
    if (isRestDay) {
      finishLocally(weightValue, 'rest', false);
      return;
    }
    if (!workout?.trainingDay || workout.exercises.length === 0) {
      setModal('none');
      showToast('今日训练计划不可用，草稿已保留', 'error');
      return;
    }
    const missingPage = workout.exercises.find((exercise) => !exercise.notionPageId);
    if (missingPage) {
      setModal('none');
      showToast('当前是容灾计划，无法正式写回 Notion；草稿已保留', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const submittedExercises = workout.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        notionPageId: exercise.notionPageId as string,
        name: exercise.name,
        sets: appData.currentSession[exercise.exerciseId] || exercise.savedSets || Array.from({ length: 4 }, () => ({ weight: '', reps: '', completed: false })),
        feedback: appData.currentFeedback[exercise.exerciseId] || exercise.savedFeedback || {},
      }));
      await completeWorkout({
        date: workout.date,
        trainingDay: workout.trainingDay,
        submissionId: crypto.randomUUID(),
        exercises: submittedExercises,
      });
      finishLocally(weightValue, 'workout', true, {
        date: workout.date,
        trainingDay: workout.trainingDay,
        durationMinutes: workoutStartedAt == null ? undefined : Math.max(1, Math.round((Date.now() - workoutStartedAt) / 60000)),
        exercises: submittedExercises.map(({ exerciseId, name, sets, feedback }) => ({ exerciseId, name, sets, feedback })),
      });
      showToast('训练已正式写入 Notion', 'success');
      void syncWorkout();
    } catch (error) {
      setModal('none');
      showToast(`${error instanceof Error ? error.message : '写回失败'}；本地草稿已保留，可重试`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMainAction = () => {
    if (checkFilledToday()) {
      setModal('actionSheet');
      return;
    }
    if (workout?.isRecoveryDay) {
      setModalData({ isRestDay: true });
      const lastRecord = appData.weightRecords.at(-1);
      const shouldAskWeight = !lastRecord || Math.ceil((new Date(dateKey()).getTime() - new Date(lastRecord.date).getTime()) / 86_400_000) >= 3;
      if (shouldAskWeight) setModal('weight');
      else void confirmFinishDay('', true);
      return;
    }

    const isWorkoutDone = workout?.exercises.some((exercise) => appData.currentSession[exercise.exerciseId]?.some((set) => set.completed)) ?? false;
    if (!isWorkoutDone) {
      showToast('完成至少一组训练后才能同步数据', 'error');
      return;
    }
    const isRestDay = false;
    let shouldAskWeight = true;
    const lastRecord = appData.weightRecords.at(-1);
    if (lastRecord) {
      const elapsed = new Date(dateKey()).getTime() - new Date(lastRecord.date).getTime();
      shouldAskWeight = Math.ceil(elapsed / 86_400_000) >= 3;
    }
    setModalData({ isRestDay });
    if (shouldAskWeight) setModal('weight');
    else void confirmFinishDay('', isRestDay);
  };

  const manualAddWeight = (value: string) => {
    if (!value) {
      setModal('none');
      return;
    }
    const currentDate = dateKey();
    const weightRecords = [...appData.weightRecords];
    const existing = weightRecords.findIndex((record) => record.date === currentDate);
    if (existing >= 0) weightRecords[existing] = { date: currentDate, val: value };
    else weightRecords.push({ date: currentDate, val: value });
    if (weightRecords.length > 30) weightRecords.shift();
    setAppData((previous) => ({ ...previous, weightRecords }));
    setModal('none');
    showToast('体重数据已校准', 'success');
  };

  const undoCheckIn = () => {
    const currentDate = dateKey();
    if (appData.history[currentDate]?.syncedToNotion) {
      setModal('none');
      showToast('Notion 是正式记录，当前阶段不支持从 App 撤销已同步训练', 'info');
      return;
    }
    const history = { ...appData.history };
    delete history[currentDate];
    setAppData((previous) => ({ ...previous, history }));
    setModal('none');
    showToast('本地打卡已撤销', 'info');
  };

  const isFilled = checkFilledToday();
  const modalType = (modalData as { type?: 'rest' | 'workout' } | null)?.type;
  const switchTab = (tab: 'today' | 'records' | 'coach') => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isAuthenticated !== true) {
    return <AuthGate onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen text-white bg-black font-sans selection:bg-accent selection:text-black flex flex-col">
      <FeedbackLayer items={feedbacks} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className={activeTab === 'today' ? 'block' : 'hidden'}>
        <Header filledCount={Object.keys(appData.history).length} onOpenSettings={() => setModal('data')} />
        <TodaySummary
          workout={workout}
          isFilled={isFilled}
          onStart={() => { if (workout?.isRecoveryDay) return; setWorkoutStartedAt((previous) => previous ?? Date.now()); setIsWorkoutMode(true); }}
        />

        <main id="today-workout" className="px-4 mt-6 pb-48 scroll-mt-4">
          <WorkoutSection
            workout={workout}
            isLoading={isWorkoutLoading}
            lastWeights={appData.lastWeights}
            sessionData={appData.currentSession}
            feedbackData={appData.currentFeedback}
            onSessionChange={handleSessionChange}
            onFeedbackChange={handleFeedbackChange}
            onFeedback={triggerFeedback}
            onOpenExerciseModal={(exercise) => { setModalData(exercise); setModal('exercise'); }}
            onRetry={() => void syncWorkout()}
          />
        </main>

        <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent pt-4 pb-2 px-5 z-50 flex justify-center pointer-events-none">
          <button onClick={handleMainAction} disabled={isSubmitting} className={`pointer-events-auto w-full max-w-[440px] h-[56px] font-black text-lg italic flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${isFilled ? 'bg-[#111] text-accent border-2 border-accent' : 'bg-accent text-black'}`} style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}>
            {isSubmitting ? '正在写入 Notion...' : isFilled ? <><i className="fas fa-check-circle mr-2" />今日同步已完成</> : '完成打卡'}
          </button>
        </div>
      </div>

      <div className={activeTab === 'records' ? 'block' : 'hidden'}>
        <main className="pb-28">
          <WeightChart records={appData.weightRecords} onAddWeight={() => { setModalData(null); setModal('weight'); }} />
          <StatsOverview history={appData.history} onDateClick={(date, record) => { setModalData({ date, record }); setModal('history'); }} />
        </main>
      </div>

      <div className={activeTab === 'coach' ? 'block' : 'hidden'}>
        <main className="pb-28">
          <AIChat context={{ workout, session: appData.currentSession, feedback: appData.currentFeedback }} reviewToken={reviewToken} />
        </main>
      </div>

      {isWorkoutMode && (
        <WorkoutMode
          workout={workout}
          lastWeights={appData.lastWeights}
          sessionData={appData.currentSession}
          feedbackData={appData.currentFeedback}
          onSessionChange={handleSessionChange}
          onFeedbackChange={handleFeedbackChange}
          onOpenExerciseModal={(exercise) => { setModalData(exercise); setModal('exercise'); }}
          onAskAI={() => { setIsWorkoutMode(false); setActiveTab('coach'); }}
          onExit={() => setIsWorkoutMode(false)}
        />
      )}

      {workoutSummary && (
        <TrainingSummary
          summary={workoutSummary}
          onClose={() => { setWorkoutSummary(null); setReviewToken((token) => token + 1); setActiveTab('today'); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          onOpenAIChat={() => { setWorkoutSummary(null); setReviewToken((token) => token + 1); setActiveTab('coach'); }}
          onReviewSaved={() => setReviewToken((token) => token + 1)}
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-[#252525] bg-black/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]" aria-label="主导航">
        <div className="max-w-[440px] mx-auto h-[70px] grid grid-cols-3 px-4 gap-2">
          <button onClick={() => switchTab('today')} aria-current={activeTab === 'today' ? 'page' : undefined} className={`flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-colors ${activeTab === 'today' ? 'text-accent' : 'text-gray-600'}`}>
            <i className="fas fa-calendar-day text-lg" />
            <span>今日</span>
          </button>
          <button onClick={() => switchTab('records')} aria-current={activeTab === 'records' ? 'page' : undefined} className={`flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-colors ${activeTab === 'records' ? 'text-accent' : 'text-gray-600'}`}>
            <i className="fas fa-chart-line text-lg" />
            <span>记录</span>
          </button>
          <button onClick={() => switchTab('coach')} aria-current={activeTab === 'coach' ? 'page' : undefined} className={`flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-colors ${activeTab === 'coach' ? 'text-accent' : 'text-gray-600'}`}>
            <i className="fas fa-comment-dots text-lg" />
            <span>教练</span>
          </button>
        </div>
      </nav>

      {modal === 'weight' && <WeightModal title={appData.weightRecords.length === 0 ? '初始体重' : '记录体重'} onConfirm={(value) => typeof (modalData as { isRestDay?: unknown } | null)?.isRestDay === 'boolean' ? void confirmFinishDay(value) : manualAddWeight(value)} onSkip={() => typeof (modalData as { isRestDay?: unknown } | null)?.isRestDay === 'boolean' ? void confirmFinishDay('') : setModal('none')} showSkip />}
      {modal === 'actionSheet' && <ActionSheet onClose={() => setModal('none')} onUndo={undoCheckIn} />}
      {modal === 'history' && modalData && <HistoryModal date={String((modalData as { date: string }).date)} record={(modalData as { record?: HistoryRecord }).record} onClose={() => setModal('none')} />}
      {modal === 'exercise' && modalData && <ExerciseModal exercise={modalData as ExercisePlan} onClose={() => setModal('none')} onStart={() => { setModal('none'); showToast('开始训练!', 'success'); }} />}
      {modal === 'data' && <DataManagement onClose={() => setModal('none')} onSuccess={(message) => showToast(message, 'success')} onError={(message) => showToast(message, 'error')} />}
      {modal === 'celebration' && <CelebrationLayer type={modalType || 'workout'} onFinish={() => { setModal('none'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
    </div>
  );
};

export default App;
