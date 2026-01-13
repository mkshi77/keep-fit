import React, { useEffect, useRef } from 'react';
import { YEAR } from '../constants';
import { HistoryRecord } from '../types';

interface CalendarProps {
  history: Record<string, HistoryRecord>;
  onDateClick: (dateKey: string, record?: HistoryRecord) => void;
}

const Calendar: React.FC<CalendarProps> = ({ history, onDateClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const cellSize = 28; // Approximate px
  const cellGap = 4;

  useEffect(() => {
    if (todayRef.current) {
        todayRef.current.scrollIntoView({ inline: 'center', behavior: 'smooth' });
    }
  }, []);

  const renderCells = () => {
    const cells = [];
    const monthLabels = [];
    
    const startOffset = 3;
    const totalDays = 365 + startOffset;
    let currentMonth = -1;
    const todayStr = new Date().toDateString();

    for (let i = 0; i < totalDays; i++) {
        const isSpacer = i < startOffset;
        if (isSpacer) {
             cells.push(<div key={`spacer-${i}`} className="w-[28px] h-[28px] opacity-0 pointer-events-none" />);
             continue;
        }

        const dayIndex = i - startOffset;
        const date = new Date(YEAR, 0, dayIndex + 1);
        const dateKey = date.toLocaleDateString('zh-CA'); // YYYY-MM-DD
        const isToday = date.toDateString() === todayStr;

        // Month Labels
        if (date.getMonth() !== currentMonth) {
            currentMonth = date.getMonth();
            const leftPos = Math.floor(i / 7) * (cellSize + cellGap);
            monthLabels.push(
                <span 
                    key={`month-${currentMonth}`}
                    className="absolute font-bold text-[10px] text-gray-600"
                    style={{ left: leftPos }}
                >
                    {date.toLocaleDateString('en-US', { month: 'short' })}
                </span>
            );
        }

        // Cell Logic
        const hist = history[dateKey];
        let bgClass = 'bg-[#1a1a1a]';
        let shadowClass = '';
        
        if (hist) {
            if (hist.type === 'rest') {
                bgClass = 'bg-rest';
                shadowClass = 'shadow-[0_0_5px_rgba(0,204,255,0.3)]';
            } else {
                bgClass = 'bg-accent';
                shadowClass = 'shadow-[0_0_5px_rgba(204,255,0,0.3)]';
            }
        }

        const borderClass = isToday ? 'border-2 border-white z-10' : '';

        cells.push(
            <div
                key={dateKey}
                ref={isToday ? todayRef : null}
                onClick={() => onDateClick(dateKey, hist)}
                className={`w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] rounded transition-transform duration-100 ${bgClass} ${shadowClass} ${borderClass}`}
            />
        );
    }

    return { cells, monthLabels };
  };

  const { cells, monthLabels } = renderCells();

  return (
    <div className="bg-[#0a0a0a] pt-2 pb-4 border-b border-[#222]">
      <div className="no-scrollbar overflow-x-auto flex pl-2.5 pr-5" ref={scrollRef}>
        <div className="sticky left-0 z-20 bg-[#0a0a0a] flex flex-col justify-end pr-2 mt-5 gap-[4px] sm:gap-[5px]">
             {['Mon', 'Wed', 'Fri'].map(d => (
                 <div key={d} className="h-[28px] sm:h-[32px] leading-[28px] sm:leading-[32px] text-[9px] text-[#444] text-right">
                     {d}
                 </div>
             ))}
        </div>
        <div className="flex flex-col">
            <div className="relative h-5 mb-1">
                {monthLabels}
            </div>
            <div className="grid grid-rows-7 grid-flow-col gap-[4px] sm:gap-[5px]">
                {cells}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;