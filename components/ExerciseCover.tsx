import { Play } from 'lucide-react';
import React from 'react';
import type { ExercisePlan } from '../types';

export const getYouTubeThumbnail = (url?: string) => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    let videoId = '';
    if (parsed.hostname === 'youtu.be') videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
    else if (parsed.hostname.endsWith('youtube.com')) {
      videoId = parsed.searchParams.get('v') || '';
      if (!videoId) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(parts[0])) videoId = parts[1] || '';
      }
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(videoId)
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : undefined;
  } catch {
    return undefined;
  }
};

interface ExerciseCoverProps {
  exercise: ExercisePlan;
}

const ExerciseCover: React.FC<ExerciseCoverProps> = ({ exercise }) => {
  const image = exercise.cover || getYouTubeThumbnail(exercise.youtube);
  if (image) {
    return <img src={image} alt={`${exercise.name} 教学封面`} loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-75" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#3b170d_0,#17120f_35%,#050505_78%)]">
      <div className="absolute -right-8 -top-12 w-44 h-44 rounded-full border-[28px] border-red-600/10" />
      <div className="absolute -left-10 bottom-[-50px] w-52 h-28 rotate-[-12deg] bg-gradient-to-r from-red-600/20 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center pb-4">
        <div className="w-16 h-11 rounded-xl bg-red-600/90 shadow-[0_0_28px_rgba(220,38,38,0.25)] flex items-center justify-center">
          <Play className="text-white text-2xl" />
        </div>
      </div>
      <div className="absolute top-4 left-4 font-mono text-[9px] font-black tracking-[0.24em] text-white/35">FORM GUIDE / 中文教学</div>
    </div>
  );
};

export default ExerciseCover;
