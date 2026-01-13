import React from 'react';
import { WeightRecord } from '../types';

interface WeightChartProps {
  records: WeightRecord[];
  onAddWeight: () => void;
}

const WeightChart: React.FC<WeightChartProps> = ({ records, onAddWeight }) => {
  const currentWeight = records.length > 0 ? records[records.length - 1].val : '--';
  
  const renderChart = () => {
    if (records.length < 2) {
      return <p className="text-xs text-gray-700 w-full text-center self-center">记录3次体重后解锁曲线</p>;
    }

    const weights = records.map(r => parseFloat(r.val));
    const min = Math.min(...weights) - 0.5;
    const max = Math.max(...weights) + 0.5;
    
    const width = 1000;
    const height = 100;
    
    let points = "";
    const circles = records.map((r, i) => {
        const x = (i / (records.length - 1)) * width;
        const val = parseFloat(r.val);
        const y = height - ((val - min) / (max - min)) * height;
        points += `${x},${y} `;
        
        return (
            <circle 
                key={i} 
                cx={x} 
                cy={y} 
                r="3" 
                className="fill-black stroke-accent stroke-2" 
            />
        );
    });

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <polyline 
                points={points} 
                fill="none" 
                stroke="#ccff00" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="drop-shadow-[0_0_4px_rgba(204,255,0,1)]"
            />
            {circles}
        </svg>
    );
  };

  return (
    <div className="bg-[#0a0a0a] px-5 pb-2 relative group">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-gray-500">Weight Trend</span>
        <div className="flex items-center gap-2">
            <span className="text-xs text-white font-mono font-bold">{currentWeight} kg</span>
            <button 
                onClick={onAddWeight}
                className="w-5 h-5 rounded bg-[#222] text-accent flex items-center justify-center text-[10px] hover:bg-accent hover:text-black transition-colors"
                aria-label="Add Weight Manually"
            >
                <i className="fas fa-plus"></i>
            </button>
        </div>
      </div>
      <div className="h-[100px] w-full relative bg-gradient-to-b from-[#111] to-black border-b border-[#222] overflow-hidden flex items-end px-2.5">
        {renderChart()}
      </div>
    </div>
  );
};

export default WeightChart;