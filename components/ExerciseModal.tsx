import React, { useEffect, useRef, useState } from 'react';
import { Exercise } from '../types';

interface ExerciseModalProps {
    exercise: Exercise;
    onClose: () => void;
    onStart: () => void;
}

const ExerciseModal: React.FC<ExerciseModalProps> = ({ exercise, onClose, onStart }) => {
    const isVideo = exercise.gif.toLowerCase().endsWith('.mp4') || exercise.gif.toLowerCase().endsWith('.webm');
    const videoRef = useRef<HTMLVideoElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (video && isVideo) {
            // 关键属性设置
            video.muted = true;
            video.defaultMuted = true;
            video.playsInline = true;
            video.setAttribute('webkit-playsinline', '');

            // 尝试播放
            const attemptPlay = async () => {
                try {
                    await video.play();
                    setIsPlaying(true);
                } catch {
                    setIsPlaying(false);
                }
            };

            // 稍微延迟，等待 Modal 动画完成
            const t = setTimeout(attemptPlay, 300);

            const onPlay = () => setIsPlaying(true);
            const onPause = () => setIsPlaying(false);

            video.addEventListener('play', onPlay);
            video.addEventListener('pause', onPause);

            return () => {
                clearTimeout(t);
                video.removeEventListener('play', onPlay);
                video.removeEventListener('pause', onPause);
            };
        }
    }, [exercise.gif, isVideo]);

    const handleManualPlay = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play().catch(() => { });
            } else {
                videoRef.current.pause();
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center animate-fade-in backdrop-blur-xl p-4">
            <div className="absolute inset-0" onClick={onClose}></div>

            <div className="bg-[#121212] w-full max-w-[360px] h-[80vh] max-h-[700px] rounded-[2rem] border border-[#222] relative z-10 flex flex-col shadow-2xl overflow-hidden animate-pop-in">

                <div className="px-5 pt-5 pb-2 bg-[#121212] z-20">
                    <div className="flex justify-between items-start mb-1">
                        <div>
                            <h2 className="text-white font-black italic text-lg tracking-wider">{exercise.name}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <i className="fas fa-bullseye text-accent/80 text-[9px]"></i>
                                <div className="flex gap-2">
                                    {exercise.targetMuscles?.map((muscle, idx) => (
                                        <span key={idx} className="text-[9px] text-accent font-bold uppercase tracking-tight">
                                            {muscle}{idx < (exercise.targetMuscles?.length || 0) - 1 ? ' ·' : ''}
                                        </span>
                                    )) || <span className="text-[9px] text-gray-600">综合训练</span>}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#222] text-gray-500 hover:text-white transition-colors flex items-center justify-center">
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </div>
                </div>

                <div
                    className="w-full aspect-video bg-black relative flex items-center justify-center shrink-0 z-10 border-y border-[#222] mt-2 overflow-hidden cursor-pointer"
                    onClick={handleManualPlay}
                >
                    {isVideo ? (
                        <video
                            ref={videoRef}
                            key={exercise.gif}
                            src={exercise.gif}
                            className="w-full h-full object-contain"
                            playsInline
                            autoPlay
                            muted
                            loop
                            preload="auto"
                        />
                    ) : (
                        <img
                            key={exercise.gif}
                            src={exercise.gif}
                            alt={exercise.name}
                            className="w-full h-full object-cover"
                        />
                    )}
                    {!isPlaying && isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] transition-all">
                            <div className="w-14 h-14 rounded-full bg-accent/90 flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.4)] pl-1">
                                <i className="fas fa-play text-black text-2xl"></i>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar relative">
                    <div className="px-5 pt-4">
                        <div className="mb-5">
                            <h3 className="text-gray-500 font-black text-[9px] mb-3 flex items-center gap-2 uppercase tracking-[0.2em]">
                                <span className="w-1 h-1 bg-accent rounded-full animate-pulse"></span>
                                STEPS
                            </h3>
                            <div className="space-y-3">
                                {exercise.steps?.map((step, idx) => (
                                    <div key={idx} className="flex gap-3">
                                        <span className="flex-shrink-0 w-4 h-4 rounded-md bg-[#222] text-accent text-[9px] font-black flex items-center justify-center font-mono">
                                            {idx + 1}
                                        </span>
                                        <p className="text-gray-400 text-xs leading-relaxed font-medium">
                                            {step}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-accent/5 border border-accent/10 rounded-xl p-3.5 mb-24">
                            <div className="flex items-center gap-2 mb-1.5">
                                <i className="fas fa-shield-halved text-accent text-[10px]"></i>
                                <h3 className="text-accent font-black text-[9px] uppercase tracking-wider">PRO TIPS</h3>
                            </div>
                            <p className="text-accent/80 text-[10px] leading-relaxed font-bold">
                                {exercise.tips || "保持动作匀速，顶峰收缩时停留1秒以获得最大泵感。"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#121212] via-[#121212] to-transparent z-20">
                    <button
                        onClick={onStart}
                        className="w-full bg-accent text-black font-black text-base py-3.5 rounded-xl hover:bg-white transition-all shadow-[0_0_15px_rgba(204,255,0,0.2)] active:scale-95 uppercase italic tracking-wider"
                    >
                        开始训练
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ExerciseModal;
