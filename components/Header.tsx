import { Settings } from 'lucide-react';
import React from 'react';

interface HeaderProps {
  filledCount: number;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ filledCount, onOpenSettings }) => (
  <header className="flex items-center justify-between gap-4 px-5 pb-5 pt-[calc(24px+env(safe-area-inset-top))]">
    <div>
      <p className="flex items-center gap-2 text-xs text-gray-400"><img src="/keep-fit-mark.png" alt="" className="h-8 w-8 rounded-lg" />Keep Fit · AI 力量训练助理</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">细狗，长了么？</h1>
      <p className="mt-1 text-xs text-gray-500">已记录 {filledCount} 天，继续稳稳变强。</p>
    </div>
    <button onClick={onOpenSettings} aria-label="设置" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400"><Settings size={20} /></button>
  </header>
);

export default Header;
