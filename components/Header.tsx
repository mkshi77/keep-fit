import React from 'react';

interface HeaderProps {
  filledCount: number;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ filledCount, onOpenSettings }) => {
  const today = new Date();

  // Format Date: 01/12
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const weekDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][today.getDay()];

  return (
    <header className="px-5 pt-12 pb-2 bg-black">
      {/* Title Row */}
      <div className="mb-2 flex justify-between items-center">
        <h1 className="text-3xl font-black italic text-white tracking-wider transform -skew-x-6">
          细狗,长了么<span className="text-accent">?</span>
        </h1>
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-full bg-[#1a1a1a] border border-[#222] text-gray-500 hover:text-accent hover:border-accent/30 transition-all flex items-center justify-center"
        >
          <i className="fas fa-cog text-sm"></i>
        </button>
      </div>

      {/* Stats Row (Date & Streak) */}
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col justify-end">
          <div className="text-[10px] text-gray-600 font-mono font-bold leading-none mb-0.5 uppercase tracking-widest">{weekDay}</div>
          <div className="text-xl font-black italic text-accent font-mono leading-none tracking-tight">
            {month}<span className="text-gray-500">/</span>{day}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] text-gray-500 font-mono mb-0.5 uppercase tracking-widest leading-none">Streak</div>
          <div className="text-4xl font-black text-white font-mono leading-none flex items-baseline justify-end gap-1">
            <span className="text-accent drop-shadow-[0_0_15px_rgba(204,255,0,0.15)]">
              {filledCount.toString().padStart(3, '0')}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;