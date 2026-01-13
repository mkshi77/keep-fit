import React, { useState, useEffect, useCallback } from 'react';
import { DB_KEY, PLANS, FEEDBACK_TEXTS, INITIAL_DIET } from './constants';
import { AppData, ModalType, ToastState, WorkoutSet, FeedbackItem, Exercise } from './types';
import Header from './components/Header';
import WeightChart from './components/WeightChart';
import StatsOverview from './components/StatsOverview';
import DietSection from './components/DietSection';
import WorkoutSection from './components/WorkoutSection';
import Toast from './components/Toast';
import FeedbackLayer from './components/FeedbackLayer';
import ExerciseModal from './components/ExerciseModal';
import { WeightModal, ActionSheet, HistoryModal, CelebrationLayer } from './components/Modals';

const INITIAL_DATA: AppData = {
  lastLogin: '',
  history: {},
  weightRecords: [],
  lastWeights: {},
  currentDiet: INITIAL_DIET, // 确保初始就有加餐预设，满足用户保留建议的需求
  currentPlan: 'upper',
  currentSession: {}
};

const App: React.FC = () => {
  const [appData, setAppData] = useState<AppData>(INITIAL_DATA);
  const [isLoaded, setIsLoaded] = useState(false);

  // UI State
  const [modal, setModal] = useState<ModalType>('none');
  const [modalData, setModalData] = useState<any>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);

  // Load Data
  useEffect(() => {
    const raw = localStorage.getItem(DB_KEY);
    const todayStr = new Date().toDateString();

    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.lastLogin !== todayStr) {
        setAppData({
          ...saved,
          lastLogin: todayStr,
          currentDiet: (saved.currentDiet || INITIAL_DIET).map((d: any) => ({ ...d, checked: false })),
          currentSession: {}
        });
      } else {
        setAppData(saved);
      }
    } else {
      setAppData({ ...INITIAL_DATA, lastLogin: todayStr });
      setTimeout(() => setModal('weight'), 800);
    }
    setIsLoaded(true);
  }, []);

  // Save Data
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(DB_KEY, JSON.stringify(appData));
    }
  }, [appData, isLoaded]);

  // Helpers
  const showToast = (message: string, type: ToastState['type'] = 'info') => {
    setToast({ show: true, message, type });
  };

  const triggerFeedback = useCallback((x: number, y: number, type: 'diet' | 'workout') => {
    const texts = FEEDBACK_TEXTS[type];
    const text = texts[Math.floor(Math.random() * texts.length)];
    const color = type === 'diet' ? '#ccff00' : '#00ccff';
    const id = Date.now();
    setFeedbacks(prev => [...prev, { id, x, y, text, color }]);
    setTimeout(() => {
      setFeedbacks(prev => prev.filter(f => f.id !== id));
    }, 2500);
  }, []);

  // Actions
  const handleDietChange = (items: any) => setAppData(prev => ({ ...prev, currentDiet: items }));
  const handlePlanSwitch = (plan: 'upper' | 'lower') => setAppData(prev => ({ ...prev, currentPlan: plan }));
  const handleSessionChange = (newData: Record<string, WorkoutSet[]>, exName?: string, weight?: string) => {
    setAppData(prev => {
      const updates: Partial<AppData> = { currentSession: newData };
      if (exName && weight) {
        updates.lastWeights = { ...prev.lastWeights, [exName]: weight };
      }
      return { ...prev, ...updates };
    });
  };

  const getRenderSessionData = () => ({ ...appData.currentSession });

  const checkFilledToday = () => {
    const dateKey = new Date().toLocaleDateString('zh-CA');
    return !!appData.history[dateKey];
  };

  const handleMainAction = () => {
    if (checkFilledToday()) {
      setModal('actionSheet');
    } else {
      const dietDone = (appData.currentDiet || []).some(d => d.checked);
      const exercises = PLANS[appData.currentPlan];
      const isWorkoutDone = exercises.some(ex => {
        const sets = appData.currentSession[ex.id];
        return sets && sets.some(s => s.completed);
      });

      if (!dietDone && !isWorkoutDone) {
        showToast("完成一项饮食或训练才能同步数据", 'error');
        return;
      }

      const isRestDay = dietDone && !isWorkoutDone;
      let shouldAskWeight = true;
      if (appData.weightRecords.length > 0) {
        const lastRecord = appData.weightRecords[appData.weightRecords.length - 1];
        const currentStr = new Date().toLocaleDateString('zh-CA');
        const diffTime = new Date(currentStr).getTime() - new Date(lastRecord.date).getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 3) shouldAskWeight = false;
      }

      setModalData({ isRestDay });
      if (shouldAskWeight) setModal('weight');
      else confirmFinishDay('', isRestDay);
    }
  };

  const confirmFinishDay = (weightVal: string, overrideIsRestDay?: boolean) => {
    const dateKey = new Date().toLocaleDateString('zh-CA');
    let newWeights = [...appData.weightRecords];
    if (weightVal) {
      newWeights.push({ date: dateKey, val: weightVal });
      if (newWeights.length > 30) newWeights.shift();
    }

    if (modalData?.isRestDay === undefined && overrideIsRestDay === undefined && appData.weightRecords.length === 0) {
      setAppData(prev => ({ ...prev, weightRecords: newWeights }));
      setModal('none');
      return;
    }

    const isRest = overrideIsRestDay !== undefined ? overrideIsRestDay : modalData?.isRestDay;
    const type = isRest ? 'rest' : 'workout';

    let sessionSnapshot: Record<string, WorkoutSet[]> = {};
    if (type === 'workout') {
      PLANS[appData.currentPlan].forEach(ex => {
        if (appData.currentSession[ex.id]) sessionSnapshot[ex.id] = appData.currentSession[ex.id];
      });
    }

    const newHistory = { ...appData.history };
    newHistory[dateKey] = {
      type,
      diet: (appData.currentDiet || []).filter(d => d.checked),
      workoutPlan: type === 'rest' ? null : appData.currentPlan,
      workoutSession: type === 'rest' ? undefined : sessionSnapshot
    };

    setAppData(prev => ({ ...prev, history: newHistory, weightRecords: newWeights, currentSession: {} }));
    setModalData({ type });
    setModal('celebration');
  };

  const manualAddWeight = (val: string) => {
    const dateKey = new Date().toLocaleDateString('zh-CA');
    let newWeights = [...appData.weightRecords];
    const existingIdx = newWeights.findIndex(r => r.date === dateKey);
    if (existingIdx >= 0) newWeights[existingIdx].val = val;
    else newWeights.push({ date: dateKey, val });
    if (newWeights.length > 30) newWeights.shift();
    setAppData(prev => ({ ...prev, weightRecords: newWeights }));
    setModal('none');
    showToast("体重数据已校准", 'success');
  };

  const undoCheckIn = () => {
    const dateKey = new Date().toLocaleDateString('zh-CA');
    const newHistory = { ...appData.history };
    delete newHistory[dateKey];
    setAppData(prev => ({ ...prev, history: newHistory }));
    setModal('none');
    showToast("数据同步已撤销", 'info');
  };

  const isFilled = checkFilledToday();

  return (
    <div className="min-h-screen text-white bg-black font-sans selection:bg-accent selection:text-black flex flex-col">
      <FeedbackLayer items={feedbacks} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <Header filledCount={Object.keys(appData.history).length} />
      <WeightChart records={appData.weightRecords} onAddWeight={() => setModal('weight')} />
      <StatsOverview history={appData.history} onDateClick={(date, rec) => { setModalData({ date, record: rec }); setModal('history'); }} />

      <main className="px-4 mt-6 pb-24">
        <DietSection items={appData.currentDiet || []} setItems={handleDietChange} onFeedback={triggerFeedback} />
        <WorkoutSection
          currentPlan={appData.currentPlan}
          onSwitchPlan={handlePlanSwitch}
          lastWeights={appData.lastWeights}
          sessionData={getRenderSessionData()}
          onSessionChange={handleSessionChange}
          onFeedback={triggerFeedback}
          onOpenExerciseModal={(ex) => { setModalData(ex); setModal('exercise'); }}
        />
      </main>

      {/* 优化底部遮挡问题 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] px-5 z-50 flex justify-center pointer-events-none">
        <button
          onClick={handleMainAction}
          className={`pointer-events-auto w-full max-w-[440px] h-[58px] font-black text-xl italic flex items-center justify-center transition-all duration-200 active:scale-95 ${isFilled
              ? 'bg-[#111] text-accent border-2 border-accent shadow-[0_0_15px_rgba(204,255,0,0.15)]'
              : 'bg-accent text-black shadow-[0_0_25px_rgba(204,255,0,0.4)]'
            }`}
          style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
        >
          {isFilled ? <><i className="fas fa-check-circle mr-2"></i>今日同步已完成</> : <>完成打卡</>}
        </button>
      </div>

      {modal === 'weight' && (
        <WeightModal
          title={appData.weightRecords.length === 0 ? "初始体重" : "记录体重"}
          onConfirm={(val) => modalData?.isRestDay !== undefined ? confirmFinishDay(val) : manualAddWeight(val)}
          onSkip={() => modalData?.isRestDay !== undefined ? confirmFinishDay('') : setModal('none')}
          showSkip={true}
        />
      )}
      {modal === 'actionSheet' && <ActionSheet onClose={() => setModal('none')} onUndo={undoCheckIn} />}
      {modal === 'history' && modalData && <HistoryModal date={modalData.date} record={modalData.record} onClose={() => setModal('none')} />}
      {modal === 'exercise' && modalData && <ExerciseModal exercise={modalData as Exercise} onClose={() => setModal('none')} onStart={() => { setModal('none'); showToast("开始训练!", "success"); }} />}
      {modal === 'celebration' && <CelebrationLayer type={modalData?.type || 'workout'} onFinish={() => { setModal('none'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
    </div>
  );
};

export default App;
