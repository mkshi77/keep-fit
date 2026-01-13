import React, { useState, useEffect, useRef } from 'react';
import { HistoryRecord } from '../types';
import { ROAST_QUOTES, YEAR } from '../constants';

interface StatsOverviewProps {
  history: Record<string, HistoryRecord>;
  onDateClick: (dateKey: string, record?: HistoryRecord) => void;
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ history, onDateClick }) => {
  const [quote, setQuote] = useState('');
  
  // Initialize with Today's date to prevent "Loading..." flash
  const getInitialDateStr = () => {
    const today = new Date();
    const dateKey = today.toLocaleDateString('zh-CA');
    const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][today.getDay()];
    return `${dateKey} (${weekDay}, Today)`;
  };
  
  const [selectedDateStr, setSelectedDateStr] = useState(getInitialDateStr());
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  // Quote Logic
  const generateQuote = () => {
    setQuote(ROAST_QUOTES[Math.floor(Math.random() * ROAST_QUOTES.length)]);
  };

  useEffect(() => {
    generateQuote();
  }, []);

  const formatDateDisplay = (dateKey: string) => {
      // dateKey is YYYY-MM-DD
      const date = new Date(dateKey + 'T00:00:00'); // append time to avoid utc shift issues locally
      if (isNaN(date.getTime())) return;

      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][date.getDay()];
      
      const text = `${dateKey} (${weekDay}${isToday ? ', Today' : ''})`;
      setSelectedDateStr(text);
  };

  const handleCellClick = (dateKey: string, hist?: HistoryRecord) => {
      formatDateDisplay(dateKey);
      onDateClick(dateKey, hist);
  }

  // Calendar Logic (Simplified Visuals)
  const renderCalendarCells = () => {
    const cells = [];
    const todayStr = new Date().toDateString();
    
    const startOffset = 3;
    const totalDays = 365 + startOffset;
    
    for (let i = 0; i < totalDays; i++) {
        const isSpacer = i < startOffset;
        if (isSpacer) {
             cells.push(<div key={`spacer-${i}`} className="w-[14px] h-[14px] opacity-0" />);
             continue;
        }

        const dayIndex = i - startOffset;
        const date = new Date(YEAR, 0, dayIndex + 1);
        const dateKey = date.toLocaleDateString('zh-CA');
        const isToday = date.toDateString() === todayStr;

        const hist = history[dateKey];
        let bgClass = 'bg-[#2a2a2a]'; // Darker base for heatmap
        
        if (hist) {
            if (hist.type === 'rest') {
                bgClass = 'bg-rest';
            } else {
                bgClass = 'bg-accent';
            }
        }
        
        const borderClass = isToday ? 'ring-1 ring-white z-10' : '';

        cells.push(
            <div
                key={dateKey}
                ref={isToday ? todayRef : null}
                onClick={() => handleCellClick(dateKey, hist)}
                className={`w-[14px] h-[14px] rounded-[2px] transition-colors ${bgClass} ${borderClass}`}
                title={dateKey}
            />
        );
    }
    return cells;
  };

  // Scroll to TODAY on load
  useEffect(() => {
    if (todayRef.current) {
        todayRef.current.scrollIntoView({ inline: 'center', block: 'nearest' });
    } else if (scrollRef.current) {
        // Fallback: Scroll to end if today is not found (e.g. wrong year)
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, []);

  return (
    <div className="px-4 space-y-4 mb-4">
      
      {/* 1. AI Coach Card (Moved Top) */}
      <div className="bg-[#1a1625] rounded-2xl p-5 border border-[#2d2440] relative overflow-hidden shadow-lg">
        {/* Glow effect */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none"></div>

        <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="flex items-center gap-2">
                <i className="fas fa-brain text-purple-400"></i>
                <span className="font-bold text-purple-200 text-sm">AI 健身教练</span>
            </div>
            <button 
                onClick={generateQuote}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors shadow-lg shadow-purple-900/50"
            >
                求鼓励
            </button>
        </div>

        <div className="relative z-10">
            <p className="text-gray-300 text-sm leading-relaxed font-mono">
                "{quote}"
            </p>
        </div>
      </div>

      {/* 2. Heatmap Card */}
      <div className="bg-[#111] rounded-2xl p-5 border border-[#222] shadow-xl">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-gray-400 font-mono text-xs tracking-widest uppercase">
                坚持热力图 (HISTORY)
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-gray-600">
                <span>少</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 bg-[#2a2a2a] rounded-[2px]"></div>
                    <div className="w-3 h-3 bg-[#1e3a1e] rounded-[2px]"></div>
                    <div className="w-3 h-3 bg-accent/50 rounded-[2px]"></div>
                    <div className="w-3 h-3 bg-accent rounded-[2px]"></div>
                </div>
                <span>多</span>
            </div>
        </div>

        {/* Heatmap Grid Container - Added min-height and padding to prevent cut-off */}
        <div 
            ref={scrollRef}
            className="overflow-x-auto no-scrollbar pb-2"
        >
            <div className="grid grid-rows-7 grid-flow-col gap-1 w-max pr-1 py-1">
                {renderCalendarCells()}
            </div>
        </div>
        
        <div className="mt-2 text-center border-t border-[#222] pt-2">
            <span className="text-[10px] text-gray-400 font-mono">当前日期：<span className="text-white">{selectedDateStr}</span></span>
        </div>
      </div>

    </div>
  );
};

export default StatsOverview;