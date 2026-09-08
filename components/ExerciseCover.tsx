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

  if (exercise.video) {
    return <video src={exercise.video} aria-label={`${exercise.name} 教学封面`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover opacity-75" />;
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#1C1C1E]">
      <img src="/keep-fit-mark.png" alt="" className="h-7 w-7 rounded-lg opacity-55" />
    </div>
  );
};

export default ExerciseCover;
