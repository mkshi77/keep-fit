import { CalendarDays, TrendingUp, MessageCircle } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DB_KEY, FALLBACK_PLANS, FALLBACK_WEEKLY_SCHEDULE } from './constants';
import type {
  AppData,
  ExerciseFeedback,
  ExercisePlan,
  HistoryRecord,
  ModalType,
  ToastState,
  TodayWorkout,
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
import CoachInsight from './components/CoachInsight';
import { completedContent, currentWorkoutSets, todayActionLabel, workoutProgress } from './services/workoutFlow';
import ExerciseModal from './components/ExerciseModal';
import DataManagement from './components/DataManagement';
import { WeightModal, HistoryModal, CelebrationLayer } from './components/Modals';
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
    const legacySameDay = saved.lastLogin === todayLoginKey();
    const hasCanonicalDraft = typeof saved.draftDate === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(saved.draftDate);
    const keepDraft = hasCanonicalDraft || legacySameDay;
    const keepCachedWorkout = saved.workoutCache
      && (saved.workoutCache.date === saved.draftDate || saved.workoutCache.date === dateKey());
    return {
      ...INITIAL_DATA,
      ...saved,
      history: migrateHistory(saved.history),
      lastLogin: todayLoginKey(),
      currentSession: keepDraft ? (saved.currentSession || {}) : {},
      workoutStartedAt: keepDraft ? saved.workoutStartedAt : undefined,
      currentExerciseId: keepDraft ? saved.currentExerciseId : undefined,
      submissionId: keepDraft ? saved.submissionId : undefined,
      currentFeedback: keepDraft ? (saved.currentFeedback || {}) : {},
      draftDate: keepDraft ? saved.draftDate : undefined,
      workoutCache: keepCachedWorkout ? saved.workoutCache : undefined,
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isWorkoutMode, setIsWorkoutMode] = useState(false);
  const submittingRef = useRef(false);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutReviewPayload | null>(null);
  const [reviewToken, setReviewToken] = useState(0);
  const handleReviewSaved = useCallback(() => setReviewToken((token) => token + 1), []);

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
        const hasFeedbackDraft = Object.values(previous.currentFeedback).some((item) => Object.values(item).some((value) => value != null));
        const draftMatchesBusinessDate = previous.draftDate === latest.date
          || (!previous.draftDate && previous.workoutCache?.date === latest.date && (hasDraft || hasFeedbackDraft));
        const savedSession = latest.exercises.reduce<Record<string, WorkoutSet[]>>((result, exercise) => {
          if (exercise.savedSets) result[exercise.exerciseId] = exercise.savedSets;
          return result;
        }, {});
        const currentSession = draftMatchesBusinessDate && hasDraft ? previous.currentSession : savedSession;
        const savedFeedback = latest.exercises.reduce<Record<string, ExerciseFeedback>>((result, exercise) => {
          if (exercise.savedFeedback) result[exercise.exerciseId] = exercise.savedFeedback;
          return result;
        }, {});
        const currentFeedback = draftMatchesBusinessDate && hasFeedbackDraft ? previous.currentFeedback : savedFeedback;
        const submittedId = latest.exercises[0]?.submissionId;
        const allCompleted = latest.source === 'notion' && latest.exercises.length > 0
          && (latest.exercises.every((exercise) => exercise.completed)
            || Boolean(submittedId && latest.exercises.every((exercise) => exercise.submissionId === submittedId)));
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
        return {
          ...previous,
          workoutCache: latest,
          currentSession,
          currentFeedback,
          history,
          draftDate: draftMatchesBusinessDate && (hasDraft || hasFeedbackDraft) ? latest.date : undefined,
          workoutStartedAt: draftMatchesBusinessDate ? previous.workoutStartedAt : undefined,
          currentExerciseId: draftMatchesBusinessDate ? previous.currentExerciseId : undefined,
          submissionId: draftMatchesBusinessDate ? previous.submissionId : undefined,
        };
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

  const handleSessionChange = (currentSession: Record<string, WorkoutSet[]>, exerciseId?: string, weight?: string) => {
    setAppData((previous) => ({
      ...previous,
      currentSession,
      draftDate: workout?.date || dateKey(),
      workoutStartedAt: previous.workoutStartedAt ?? Date.now(),
      submissionId: undefined,
      lastWeights: exerciseId && weight ? { ...previous.lastWeights, [exerciseId]: weight } : previous.lastWeights,
    }));
  };

  const handleFeedbackChange = (exerciseId: string, feedback: ExerciseFeedback) => {
    setAppData((previous) => ({
      ...previous,
      draftDate: workout?.date || dateKey(),
      submissionId: undefined,
      currentFeedback: { ...previous.currentFeedback, [exerciseId]: feedback },
    }));
  };

  const checkFilledToday = () => {
    const record = appData.history[workout?.date || dateKey()];
    return record?.type === 'rest' || record?.syncedToNotion === true;
  };

  const finishLocally = (weightValue: string, type: 'rest' | 'workout', syncedToNotion: boolean, summary?: WorkoutReviewPayload) => {
    const currentDate = summary?.date || workout?.date || dateKey();
    const weightRecords = [...appData.weightRecords];
    if (weightValue) {
      weightRecords.push({ date: currentDate, val: weightValue });
      if (weightRecords.length > 30) weightRecords.shift();
    }
    const history = { ...appData.history };
    history[currentDate] = {
      type,
      workoutPlan: type === 'workout' ? workout?.trainingDay ?? null : null,
      workoutSession: type === 'workout' ? Object.fromEntries((summary?.exercises ?? []).map((exercise) => [exercise.exerciseId, exercise.sets])) : undefined,
      workoutFeedback: type === 'workout' ? appData.currentFeedback : undefined,
      syncedToNotion,
    };
    setAppData((previous) => ({
      ...previous,
      history,
      weightRecords,
      currentSession: type === 'workout' ? {} : previous.currentSession,
      currentFeedback: type === 'workout' ? {} : previous.currentFeedback,
      workoutStartedAt: undefined,
      currentExerciseId: undefined,
      submissionId: undefined,
      draftDate: undefined,
    }));
    setModalData({ type });
    if (type === 'workout' && summary) {
      setModal('none');
      setIsWorkoutMode(false);
      setWorkoutSummary(summary);
    } else {
      setModal('celebration');
    }
  };

  const confirmFinishDay = async (weightValue: string, overrideIsRestDay?: boolean) => {
    if (submittingRef.current || checkFilledToday()) return;
    const isRestDay = overrideIsRestDay ?? Boolean((modalData as { isRestDay?: boolean } | null)?.isRestDay);
    if (isRestDay) {
      finishLocally(weightValue, 'rest', false);
      return;
    }
    if (!isWorkoutMode) return;
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
    if (workoutProgress(workout, appData.currentSession).completed === 0) {
      showToast('完成至少一组训练后才能保存', 'error');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const submittedExercises = workout.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        notionPageId: exercise.notionPageId as string,
        name: exercise.name,
        sets: completedContent(currentWorkoutSets(exercise, appData.currentSession, appData.lastWeights)),
        feedback: appData.currentFeedback[exercise.exerciseId] || exercise.savedFeedback || {},
      }));
      const submissionId = appData.submissionId || crypto.randomUUID();
      setAppData((previous) => ({ ...previous, submissionId }));
      await completeWorkout({
        date: workout.date,
        trainingDay: workout.trainingDay,
        submissionId,
        exercises: submittedExercises,
      });
      finishLocally(weightValue, 'workout', true, {
        date: workout.date,
        trainingDay: workout.trainingDay,
        durationMinutes: appData.workoutStartedAt == null ? undefined : Math.max(1, Math.round((Date.now() - appData.workoutStartedAt) / 60000)),
        exercises: submittedExercises.map(({ exerciseId, name, sets, feedback }) => ({ exerciseId, name, sets, feedback })),
      });
      showToast('训练已正式写入 Notion', 'success');
      void syncWorkout();
    } catch (error) {
      setModal('none');
      showToast(`${error instanceof Error ? error.message : '写回失败'}；本地草稿已保留，可重试`, 'error');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const startWorkout = (exerciseId?: string) => {
    if (!workout || workout.isRecoveryDay || !workout.exercises.length || checkFilledToday()) return;
    const firstUnfinished = workout.exercises.find((exercise) =>
      (appData.currentSession[exercise.exerciseId] || []).filter((set) => set.completed).length < exercise.planSets);
    setAppData((previous) => ({ ...previous, draftDate: workout.date, workoutStartedAt: previous.workoutStartedAt ?? Date.now(),
      currentExerciseId: exerciseId || previous.currentExerciseId || firstUnfinished?.exerciseId || workout.exercises[0].exerciseId }));
    setModal('none');
    setIsWorkoutMode(true);
  };

  const handleMainAction = () => {
    if (checkFilledToday()) return;
    if (workout?.isRecoveryDay) {
      setModalData({ isRestDay: true });
      setModal('weight');
    } else startWorkout();
  };

  const manualAddWeight = (value: string) => {
    if (!value) {
      setModal('none');
      return;
    }
    const currentDate = workout?.date || dateKey();
    const weightRecords = [...appData.weightRecords];
    const existing = weightRecords.findIndex((record) => record.date === currentDate);
    if (existing >= 0) weightRecords[existing] = { date: currentDate, val: value };
    else weightRecords.push({ date: currentDate, val: value });
    if (weightRecords.length > 30) weightRecords.shift();
    setAppData((previous) => ({ ...previous, weightRecords }));
    setModal('none');
    showToast('体重数据已校准', 'success');
  };

  const isFilled = checkFilledToday();
  const progress = workoutProgress(workout, appData.currentSession);
  const hasDraft = !isFilled && (appData.workoutStartedAt != null || Object.keys(appData.currentSession).length > 0);
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className={activeTab === 'today' ? 'mx-auto w-full max-w-[440px]' : 'hidden'}>
        <Header filledCount={Object.keys(appData.history).length} onOpenSettings={() => setModal('data')} />
        <TodaySummary workout={workout} />
        <main id="today-workout" className="px-4 mt-5 space-y-5 pb-[calc(100px+env(safe-area-inset-bottom))]">
          <CoachInsight workout={workout} history={appData.history} hasDraft={hasDraft} />
          <WorkoutSection workout={workout} isLoading={isWorkoutLoading}
            onOpenExerciseModal={(exercise) => { setModalData(exercise); setModal('exercise'); }}
            onRetry={() => void syncWorkout()} />
          <button onClick={handleMainAction} disabled={isFilled || !workout || (!workout.isRecoveryDay && !workout.exercises.length)}
            className="h-14 w-full rounded-full bg-[#a4ff4f] text-base font-bold text-black disabled:bg-[#1a1a1a] disabled:text-gray-400">
            {todayActionLabel(workout, isFilled, hasDraft, progress)}
          </button>
        </main>
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
          exerciseId={appData.currentExerciseId}
          onExerciseChange={(currentExerciseId) => setAppData((previous) => ({ ...previous, currentExerciseId }))}
          onFinish={() => void confirmFinishDay('', false)}
          isSubmitting={isSubmitting}
        />
      )}

      {workoutSummary && (
        <TrainingSummary
          summary={workoutSummary}
          onClose={() => { setWorkoutSummary(null); setReviewToken((token) => token + 1); setActiveTab('today'); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          onOpenAIChat={() => { setWorkoutSummary(null); setReviewToken((token) => token + 1); setActiveTab('coach'); }}
          onReviewSaved={handleReviewSaved}
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-[#252525] bg-black/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]" aria-label="主导航">
        <div className="max-w-[440px] mx-auto h-[70px] grid grid-cols-3 px-4 gap-2">
          <button onClick={() => switchTab('today')} aria-current={activeTab === 'today' ? 'page' : undefined} className={`flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-colors ${activeTab === 'today' ? 'text-accent' : 'text-gray-600'}`}>
            <CalendarDays className="text-lg" />
            <span>今日</span>
          </button>
          <button onClick={() => switchTab('records')} aria-current={activeTab === 'records' ? 'page' : undefined} className={`flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-colors ${activeTab === 'records' ? 'text-accent' : 'text-gray-600'}`}>
            <TrendingUp className="text-lg" />
            <span>记录</span>
          </button>
          <button onClick={() => switchTab('coach')} aria-current={activeTab === 'coach' ? 'page' : undefined} className={`flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-colors ${activeTab === 'coach' ? 'text-accent' : 'text-gray-600'}`}>
            <MessageCircle className="text-lg" />
            <span>教练</span>
          </button>
        </div>
      </nav>

      {modal === 'weight' && <WeightModal title={appData.weightRecords.length === 0 ? '初始体重' : '记录体重'} onConfirm={(value) => typeof (modalData as { isRestDay?: unknown } | null)?.isRestDay === 'boolean' ? void confirmFinishDay(value) : manualAddWeight(value)} onSkip={() => typeof (modalData as { isRestDay?: unknown } | null)?.isRestDay === 'boolean' ? void confirmFinishDay('') : setModal('none')} showSkip />}
      {modal === 'history' && modalData && <HistoryModal date={String((modalData as { date: string }).date)} record={(modalData as { record?: HistoryRecord }).record} onClose={() => setModal('none')} />}
      {modal === 'exercise' && modalData && <ExerciseModal exercise={modalData as ExercisePlan} onClose={() => setModal('none')} onStart={isFilled ? undefined : () => startWorkout((modalData as ExercisePlan).exerciseId)} />}
      {modal === 'data' && <DataManagement onClose={() => setModal('none')} onSuccess={(message) => showToast(message, 'success')} onError={(message) => showToast(message, 'error')} />}
      {modal === 'celebration' && <CelebrationLayer type={modalType || 'workout'} onFinish={() => { setModal('none'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
    </div>
  );
};

export default App;
