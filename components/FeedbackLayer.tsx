import React from 'react';
import { FeedbackItem } from '../types';

interface FeedbackLayerProps {
  items: FeedbackItem[];
}

const FeedbackLayer: React.FC<FeedbackLayerProps> = ({ items }) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[150] overflow-hidden">
      {items.map((item) => (
        <div
          key={item.id}
          className="absolute font-black italic text-lg whitespace-nowrap animate-[floatUp_0.8s_ease-out_forwards]"
          style={{
            left: item.x,
            top: item.y,
            color: item.color,
            textShadow: '0 2px 0 rgba(0,0,0,1)'
          }}
        >
          {item.text}
        </div>
      ))}
      <style>{`
        @keyframes floatUp {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-40px) scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default FeedbackLayer;