
import React, { useEffect, useRef, useState } from 'react';
import { PLANS, DEFAULT_SETS } from '../constants';
import { WorkoutSet, Exercise } from '../types';

interface WorkoutSectionProps {
    currentPlan: 'upper' | 'lower';
    onSwitchPlan: (plan: 'upper' | 'lower') => void;
    lastWeights: Record<string, string>;
    sessionData: Record<string, WorkoutSet[]>;
    onSessionChange: (newData: Record<string, WorkoutSet[]>, exerciseName?: string, weight?: string) => void;
    onFeedback: (x: number, y: number, type: 'diet' | 'workout') => void;
    onOpenExerciseModal: (ex: Exercise) => void;
}

const PreviewVideo: React.FC<{ src: string }> = ({ src }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Force all necessary attributes for mobile playback
        video.muted = true;
        video.defaultMuted = true;
        video.volume = 0;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('x5-playsinline', ''); // Tencent X5 kernel (WeChat, QQ browsers)
        video.setAttribute('x5-video-player-type', 'h5'); // Force H5 player on X5
        video.setAttribute('x5-video-player-fullscreen', 'false');
        video.setAttribute('x-webkit-airplay', 'allow');

        let playAttempts = 0;
        const maxAttempts = 3;

        // Aggressive play attempt with retries
        const attemptPlay = async () => {
            if (playAttempts >= maxAttempts) {
                console.log('Max play attempts reached');
                return;
            }

            playAttempts++;

            try {
                // Ensure muted before each attempt
                video.muted = true;
                video.volume = 0;

                const playPromise = video.play();

                if (playPromise !== undefined) {
                    await playPromise;
                    console.log('Video playing successfully');
                }
            } catch (err: any) {
                console.log(`Autoplay attempt ${playAttempts} failed:`, err.message);

                // Retry after a short delay
                if (playAttempts < maxAttempts) {
                    setTimeout(attemptPlay, 300);
                }
            }
        };

        // Use Intersection Observer for better mobile performance
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        attemptPlay();
                    } else {
                        video.pause();
                    }
                });
            },
            { threshold: 0.5 }
        );

        observer.observe(video);

        // Multiple event listeners for different loading states
        const onCanPlay = () => attemptPlay();
        const onLoadedData = () => attemptPlay();
        const onError = () => {
            console.error('Video loading error');
            setHasError(true);
        };

        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('loadeddata', onLoadedData);
        video.addEventListener('error', onError);

        // Global interaction unlock (for restrictive browsers)
        const unlockPlay = () => {
            if (video.paused) {
                attemptPlay();
            }
        };

        // Listen to multiple interaction events
        const events = ['touchstart', 'touchend', 'click', 'scroll'];
        events.forEach(event => {
            window.addEventListener(event, unlockPlay, { once: true, passive: true });
        });

        return () => {
            observer.disconnect();
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('loadeddata', onLoadedData);
            video.removeEventListener('error', onError);
            events.forEach(event => {
                window.removeEventListener(event, unlockPlay);
            });
        };
    }, [src]);

    // Fallback to GIF/static image if video fails
    if (hasError) {
        return (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                <i className="fas fa-play-circle text-4xl text-gray-600"></i>
            </div>
        );
    }

    return (
        <video
            ref={videoRef}
            src={src}
            muted
            playsInline
            // @ts-ignore
            webkit-playsinline=""
            // @ts-ignore
            x5-playsinline=""
            loop
            preload="metadata"
            className="w-full h-full object-cover opacity-70 pointer-events-none"
        />
    );
};

const WorkoutSection: React.FC<WorkoutSectionProps> = ({
    currentPlan,
    onSwitchPlan,
    lastWeights,
    sessionData,
    onSessionChange,
    onFeedback,
    onOpenExerciseModal
}) => {
    const exercises = PLANS[currentPlan];

    const updateSet = (exId: string, index: number, field: keyof WorkoutSet, val: any) => {
        const currentSets = sessionData[exId] || Array.from({ length: DEFAULT_SETS }, () => ({ weight: '', reps: '10', completed: false }));
        const newSets = [...currentSets];
        newSets[index] = { ...newSets[index], [field]: val };
        const newData = { ...sessionData, [exId]: newSets };
        let exName = undefined, weightVal = undefined;
        if (field === 'weight') {
            exName = exercises.find(e => e.id === exId)?.name;
            weightVal = val;
        }
        onSessionChange(newData, exName, weightVal);
    };

    const handleSetCompletion = (e: React.MouseEvent, exId: string, index: number, currentCompleted: boolean) => {
        updateSet(exId, index, 'completed', !currentCompleted);
        if (!currentCompleted) onFeedback(e.clientX - 60, e.clientY - 40, 'workout');
    };

    const addSet = (exId: string) => {
        const currentSets = sessionData[exId] || Array.from({ length: DEFAULT_SETS }, () => ({ weight: '', reps: '10', completed: false }));
        onSessionChange({ ...sessionData, [exId]: [...currentSets, { weight: '', reps: '10', completed: false }] });
    };

    const removeSet = (exId: string, index: number) => {
        const newSets = [...(sessionData[exId] || [])];
        newSets.splice(index, 1);
        onSessionChange({ ...sessionData, [exId]: newSets });
    };

    return (
        <section>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-white font-bold text-lg">
                    <i className="fas fa-dumbbell text-accent mr-2"></i>今日训练
                </h2>
                <div className="bg-[#1a1a1a] p-1 rounded-lg flex border border-[#222]">
                    {(['upper', 'lower'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => onSwitchPlan(p)}
                            className={`px-3 py-1 text-xs rounded-md transition-all duration-200 font-bold ${currentPlan === p ? 'bg-accent text-black' : 'text-gray-500 bg-transparent'
                                }`}
                        >
                            {p === 'upper' ? '上半身' : '下半身'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                {exercises.map(ex => {
                    const sets = sessionData[ex.id] || Array.from({ length: DEFAULT_SETS }, () => ({ weight: '', reps: '10', completed: false }));
                    const isVideo = ex.gif.toLowerCase().endsWith('.mp4') || ex.gif.toLowerCase().endsWith('.webm');

                    return (
                        <div key={ex.id} className="bg-card rounded-2xl overflow-hidden border border-[#222] shadow-xl">
                            <div className="w-full h-[160px] bg-black flex items-center justify-center relative cursor-pointer" onClick={() => onOpenExerciseModal(ex)}>
                                {isVideo ? (
                                    <PreviewVideo src={ex.gif} />
                                ) : (
                                    <img src={ex.gif} alt={ex.name} loading="lazy" className="w-full h-full object-cover opacity-70" />
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-black text-white text-lg tracking-wide uppercase italic">{ex.name}</h3>
                                            <i className="fas fa-circle-info text-accent/60 text-xs"></i>
                                        </div>
                                        <p className="text-gray-500 text-[10px] font-mono mt-0.5">LAST: {lastWeights[ex.name] || '--'}KG</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10">
                                        <i className="fas fa-play text-[10px] text-white/70"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="px-4 py-4">
                                <div className="space-y-2.5">
                                    {sets.map((set, idx) => (
                                        <div key={idx} className="flex items-center gap-2 justify-between">
                                            <span className="text-[10px] text-gray-700 w-3 font-mono font-bold">{idx + 1}</span>
                                            <div className="flex-1 h-10 rounded-lg flex items-center px-3 bg-[#181818] border border-[#2a2a2a]">
                                                <input type="number" className="bg-transparent text-white text-right w-full outline-none font-mono text-base font-bold" placeholder="-" value={set.weight} onChange={(e) => updateSet(ex.id, idx, 'weight', e.target.value)} disabled={set.completed} />
                                                <span className="text-[10px] text-gray-600 ml-1.5 font-bold">KG</span>
                                            </div>
                                            <span className="text-gray-800 text-xs">×</span>
                                            <div className="flex-1 h-10 rounded-lg flex items-center px-3 bg-[#181818] border border-[#2a2a2a]">
                                                <input type="number" className="bg-transparent text-white text-center w-full outline-none font-mono text-base font-bold" placeholder="10" value={set.reps} onChange={(e) => updateSet(ex.id, idx, 'reps', e.target.value)} disabled={set.completed} />
                                                <span className="text-[10px] text-gray-600 ml-1 font-bold">REPS</span>
                                            </div>
                                            <button onClick={(e) => handleSetCompletion(e, ex.id, idx, set.completed)} className={`w-11 h-10 rounded-lg flex items-center justify-center transition-all ${set.completed ? 'bg-accent text-black shadow-[0_0_10px_rgba(204,255,0,0.3)]' : 'bg-[#222] text-gray-700 border border-[#333]'}`}>
                                                <i className="fas fa-check"></i>
                                            </button>
                                            {idx >= DEFAULT_SETS && !set.completed && (
                                                <button onClick={() => removeSet(ex.id, idx)} className="text-red-900 px-1"><i className="fas fa-times"></i></button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => addSet(ex.id)} className="w-full mt-4 py-2 text-[10px] text-gray-600 border border-dashed border-[#333] rounded-lg font-bold tracking-widest uppercase hover:text-gray-400">
                                    + ADD SET
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default WorkoutSection;
