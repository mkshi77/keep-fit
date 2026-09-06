import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_SETS } from '../constants';
import type { ExerciseFeedback, ExercisePlan, TodayWorkout, WorkoutSet } from '../types';
import ExerciseCover from './ExerciseCover';

interface WorkoutSectionProps {
  workout: TodayWorkout | null;
  isLoading: boolean;
  lastWeights: Record<string, string>;
  sessionData: Record<string, WorkoutSet[]>;
  feedbackData: Record<string, ExerciseFeedback>;
  onSessionChange: (newData: Record<string, WorkoutSet[]>, exerciseId?: string, weight?: string) => void;
  onFeedbackChange: (exerciseId: string, feedback: ExerciseFeedback) => void;
  onFeedback: (x: number, y: number, type: 'diet' | 'workout') => void;
  onOpenExerciseModal: (exercise: ExercisePlan) => void;
  onRetry: () => void;
}

const makeSets = (exercise: ExercisePlan): WorkoutSet[] =>
  Array.from({ length: Math.max(DEFAULT_SETS, exercise.planSets) }, () => ({
    weight: '',
    reps: exercise.planReps.match(/\d+/)?.[0] || '10',
    completed: false,
  }));

const PreviewVideo: React.FC<{ src: string }> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('x5-playsinline', '');
    video.setAttribute('x5-video-player-type', 'h5');
    video.setAttribute('x5-video-player-fullscreen', 'false');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        else {
          video.pause();
          setIsPlaying(false);
        }
      });
    }, { threshold: 0.5 });
    observer.observe(container);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [src]);

  const toggle = async (event: React.MouseEvent) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    else {
      video.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full" onClick={toggle}>
      <video ref={videoRef} src={src} muted loop playsInline preload="metadata" className="w-full h-full object-cover opacity-70 cursor-pointer" />
      {!isPlaying && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="bg-black/50 rounded-full p-4"><i className="fas fa-play text-white text-3xl" /></div></div>}
    </div>
  );
};

const ScoreInput: React.FC<{
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  onChange: (value: number | undefined) => void;
}> = ({ label, value, min, max, onChange }) => (
  <label className="flex-1 min-w-[88px]">
    <span className="block text-[9px] text-gray-500 mb-1 font-bold">{label}</span>
    <input
      type="number"
      min={min}
      max={max}
      value={value ?? ''}
      placeholder="-"
      onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
      className="w-full h-10 rounded-lg bg-[#181818] border border-[#2a2a2a] text-white text-center font-mono font-bold outline-none focus:border-accent"
    />
  </label>
);

const WorkoutSection: React.FC<WorkoutSectionProps> = ({
  workout,
  isLoading,
  lastWeights,
  sessionData,
  feedbackData,
  onSessionChange,
  onFeedbackChange,
  onFeedback,
  onOpenExerciseModal,
  onRetry,
}) => {
  const exercises = workout?.exercises ?? [];

  const currentSets = (exercise: ExercisePlan) => sessionData[exercise.exerciseId] || makeSets(exercise);

  const updateSet = (exercise: ExercisePlan, index: number, field: keyof WorkoutSet, value: string | boolean) => {
    const sets = currentSets(exercise);
    const nextSets = [...sets];
    nextSets[index] = { ...nextSets[index], [field]: value };
    onSessionChange({ ...sessionData, [exercise.exerciseId]: nextSets }, field === 'weight' ? exercise.exerciseId : undefined, field === 'weight' ? String(value) : undefined);
  };

  const addSet = (exercise: ExercisePlan) => {
    const sets = currentSets(exercise);
    onSessionChange({ ...sessionData, [exercise.exerciseId]: [...sets, { weight: '', reps: exercise.planReps.match(/\d+/)?.[0] || '10', completed: false }] });
  };

  const removeSet = (exercise: ExercisePlan, index: number) => {
    const sets = [...currentSets(exercise)];
    sets.splice(index, 1);
    onSessionChange({ ...sessionData, [exercise.exerciseId]: sets });
  };

  if (isLoading && !workout) {
    return <section className="py-12 text-center text-gray-600 font-mono text-xs animate-pulse">正在同步今日训练...</section>;
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white font-bold text-lg"><i className="fas fa-dumbbell text-accent mr-2" />今日训练</h2>
        <div className="flex items-center gap-2">
          {workout?.source === 'fallback' && <button onClick={onRetry} className="text-[10px] text-orange-400 border border-orange-900/60 rounded px-2 py-1"><i className="fas fa-rotate mr-1" />重试同步</button>}
          <span className={`px-3 py-1 rounded-md text-xs font-black ${workout?.isRecoveryDay ? 'bg-rest text-black' : 'bg-accent text-black'}`}>
            {workout?.isRecoveryDay ? '恢复日' : `${workout?.trainingDay ?? '-'} 日`}
          </span>
        </div>
      </div>

      {workout?.warning && <div className="mb-4 px-3 py-2 rounded-lg border border-orange-900/50 bg-orange-950/20 text-orange-300 text-xs">{workout.warning}。草稿仍保存在本机。</div>}

      {workout?.isRecoveryDay ? (
        <div className="bg-card rounded-2xl border border-[#222] p-8 text-center">
          <i className="fas fa-battery-full text-rest text-3xl mb-3" />
          <h3 className="font-black text-white text-lg">恢复日</h3>
          <p className="text-gray-500 text-xs mt-2">保持饮食、睡眠和轻度活动，为下一训练日充能。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {exercises.map((exercise) => {
            const sets = currentSets(exercise);
            const feedback = feedbackData[exercise.exerciseId] || {};
            return (
              <div key={exercise.exerciseId} className="bg-card rounded-2xl overflow-hidden border border-[#222] shadow-xl">
                <div className="w-full h-[160px] bg-black flex items-center justify-center relative cursor-pointer" onClick={() => onOpenExerciseModal(exercise)}>
                  {exercise.video ? <PreviewVideo src={exercise.video} /> : <ExerciseCover exercise={exercise} />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end pointer-events-none">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="font-black text-white text-lg tracking-wide italic">{exercise.name}</h3><i className="fas fa-circle-info text-accent/60 text-xs" /></div>
                      <p className="text-gray-400 text-[10px] font-mono mt-1">计划 {exercise.planWeight || '--'} · {exercise.planSets} × {exercise.planReps}</p>
                      <p className="text-gray-600 text-[10px] font-mono">基线 {exercise.baseline || lastWeights[exercise.exerciseId] || '--'}</p>
                    </div>
                  </div>
                  {exercise.youtube && <a href={exercise.youtube} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="absolute top-3 right-3 px-3 py-2 rounded-lg bg-red-600/90 text-white text-[10px] font-bold"><i className="fab fa-youtube mr-1" />中文教学</a>}
                </div>

                <div className="px-4 py-4">
                  <div className="space-y-2.5">
                    {sets.map((set, index) => (
                      <div key={index}>
                        {index === 3 && <div className="mb-2 rounded-lg border border-accent/10 bg-accent/5 p-2 text-[9px] leading-relaxed text-accent/70">第3组后 RIR ≥ 2、动作稳定、不适 &lt; 3/10、左右差异没有恶化 → 才继续第4组</div>}
                        <div className="flex items-center gap-2 justify-between">
                          <span className="text-[10px] text-gray-700 w-3 font-mono font-bold">{index + 1}</span>
                          <div className="flex-1 h-10 rounded-lg flex items-center px-3 bg-[#181818] border border-[#2a2a2a]"><input type="number" inputMode="decimal" className="bg-transparent text-white text-right w-full outline-none font-mono text-base font-bold" placeholder="-" value={set.weight} onChange={(event) => updateSet(exercise, index, 'weight', event.target.value)} disabled={set.completed} /><span className="text-[10px] text-gray-600 ml-1.5 font-bold">KG</span></div>
                          <span className="text-gray-800 text-xs">×</span>
                          <div className="flex-1 h-10 rounded-lg flex items-center px-3 bg-[#181818] border border-[#2a2a2a]"><input type="number" inputMode="numeric" className="bg-transparent text-white text-center w-full outline-none font-mono text-base font-bold" placeholder="10" value={set.reps} onChange={(event) => updateSet(exercise, index, 'reps', event.target.value)} disabled={set.completed} /><span className="text-[10px] text-gray-600 ml-1 font-bold">REPS</span></div>
                          <button onClick={(event) => { updateSet(exercise, index, 'completed', !set.completed); if (!set.completed) onFeedback(event.clientX - 60, event.clientY - 40, 'workout'); }} className={`w-11 h-10 rounded-lg flex items-center justify-center transition-all ${set.completed ? 'bg-accent text-black shadow-[0_0_10px_rgba(204,255,0,0.3)]' : 'bg-[#222] text-gray-700 border border-[#333]'}`}><i className="fas fa-check" /></button>
                          {index >= DEFAULT_SETS && !set.completed && <button onClick={() => removeSet(exercise, index)} aria-label="删除额外组" className="text-red-900 px-1"><i className="fas fa-times" /></button>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#222]">
                    <ScoreInput label="末组 RIR" value={feedback.rir} min={0} max={10} onChange={(rir) => onFeedbackChange(exercise.exerciseId, { ...feedback, rir })} />
                    <ScoreInput label="左右差异 0–3" value={feedback.asymmetry} min={0} max={3} onChange={(asymmetry) => onFeedbackChange(exercise.exerciseId, { ...feedback, asymmetry: asymmetry as ExerciseFeedback['asymmetry'] })} />
                    <ScoreInput label="不适 0–10" value={feedback.discomfort} min={0} max={10} onChange={(discomfort) => onFeedbackChange(exercise.exerciseId, { ...feedback, discomfort })} />
                  </div>

                  <button onClick={() => addSet(exercise)} className="w-full mt-4 py-2 text-[10px] text-gray-600 border border-dashed border-[#333] rounded-lg font-bold tracking-widest uppercase hover:text-gray-400">+ ADD SET</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default WorkoutSection;
