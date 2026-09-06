import React, { useEffect, useRef, useState } from 'react';
import type { ExercisePlan } from '../types';
import ExerciseCover from './ExerciseCover';

interface ExerciseModalProps {
  exercise: ExercisePlan;
  onClose: () => void;
  onStart: () => void;
}

const ExerciseModal: React.FC<ExerciseModalProps> = ({ exercise, onClose, onStart }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', '');
    const timer = setTimeout(() => video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)), 300);
    return () => clearTimeout(timer);
  }, [exercise.video]);

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    else {
      video.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center animate-fade-in backdrop-blur-xl p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="bg-[#121212] w-full max-w-[360px] rounded-[2rem] border border-[#222] relative z-10 shadow-2xl overflow-hidden animate-pop-in">
        <div className="px-5 pt-5 pb-4 flex justify-between items-start">
          <div><h2 className="text-white font-black italic text-lg tracking-wider">{exercise.name}</h2><p className="text-accent text-[9px] font-mono mt-1">{exercise.exerciseId}</p></div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#222] text-gray-500 hover:text-white flex items-center justify-center"><i className="fas fa-times text-xs" /></button>
        </div>

        <div className="w-full aspect-video bg-black relative flex items-center justify-center border-y border-[#222] overflow-hidden cursor-pointer" onClick={toggleVideo}>
          {exercise.video ? <video ref={videoRef} src={exercise.video} className="w-full h-full object-contain" playsInline autoPlay muted loop preload="auto" /> : <ExerciseCover exercise={exercise} />}
          {exercise.video && !isPlaying && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><div className="w-14 h-14 rounded-full bg-accent/90 flex items-center justify-center pl-1"><i className="fas fa-play text-black text-2xl" /></div></div>}
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#181818] border border-[#252525] rounded-xl p-3"><span className="text-gray-600 block text-[9px] mb-1">今日计划</span><strong className="text-white">{exercise.planSets} × {exercise.planReps}</strong></div>
            <div className="bg-[#181818] border border-[#252525] rounded-xl p-3"><span className="text-gray-600 block text-[9px] mb-1">计划重量</span><strong className="text-white">{exercise.planWeight || '--'}</strong></div>
          </div>
          <div className="bg-accent/5 border border-accent/10 rounded-xl p-3"><span className="text-accent text-[9px] font-black">当前基线</span><p className="text-accent/80 text-xs mt-1">{exercise.baseline || '暂无基线'}</p></div>
          {exercise.youtube && <a href={exercise.youtube} target="_blank" rel="noreferrer" className="w-full bg-red-600 text-white font-black text-sm py-3.5 rounded-xl flex items-center justify-center gap-2"><i className="fab fa-youtube" />打开中文教学</a>}
          <button onClick={onStart} className="w-full bg-accent text-black font-black text-base py-3.5 rounded-xl active:scale-95 uppercase italic tracking-wider">开始训练</button>
        </div>
      </div>
    </div>
  );
};

export default ExerciseModal;
