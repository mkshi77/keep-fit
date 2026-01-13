import React, { useEffect, useState } from 'react';
import { HistoryRecord } from '../types';
import { PLANS, DB_KEY } from '../constants';

// --- Overlay Helper ---
const Overlay: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
    <div 
        className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center backdrop-blur-md animate-fade-in"
        onClick={onClick}
    >
        {children}
    </div>
);

// --- Weight Modal ---
interface WeightModalProps {
    title: string;
    onConfirm: (weight: string) => void;
    onSkip?: () => void;
    showSkip: boolean;
}
export const WeightModal: React.FC<WeightModalProps> = ({ title, onConfirm, onSkip, showSkip }) => {
    const [val, setVal] = useState('');

    return (
        <Overlay>
            <div className="bg-black p-6 w-[85%] max-w-[320px] text-center border-2 border-[#333] shadow-[0_0_30px_rgba(204,255,0,0.1)]" onClick={e => e.stopPropagation()}>
                <div className="text-accent text-[10px] font-mono tracking-[0.2em] mb-2 uppercase">需要输入</div>
                <h3 className="text-white font-black italic text-2xl mb-6">{title}</h3>
                
                <div className="flex items-end justify-center gap-2 mb-8">
                    <input 
                        type="number" 
                        step="0.1"
                        autoFocus
                        className="bg-transparent text-white text-5xl font-black w-32 text-center outline-none border-b-2 border-[#333] focus:border-accent transition-colors pb-1 placeholder-[#333]"
                        placeholder="00.0"
                        value={val}
                        onChange={e => setVal(e.target.value)}
                    />
                    <span className="text-gray-500 font-bold text-lg pb-3">KG</span>
                </div>
                
                <button 
                    onClick={() => onConfirm(val)}
                    className="w-full bg-white text-black font-black text-lg py-4 hover:bg-accent transition-colors uppercase tracking-wider"
                >
                    确认
                </button>
                
                {showSkip && (
                    <button onClick={onSkip} className="mt-4 text-[10px] text-gray-600 hover:text-gray-400 uppercase tracking-widest">
                        跳过
                    </button>
                )}
            </div>
        </Overlay>
    );
};

// --- Action Sheet ---
interface ActionSheetProps {
    onClose: () => void;
    onUndo: () => void;
}
export const ActionSheet: React.FC<ActionSheetProps> = ({ onClose, onUndo }) => {
    const handleReset = () => {
        if (confirm("确定要清空所有历史数据和记录吗？此操作无法撤销。")) {
            localStorage.removeItem(DB_KEY);
            window.location.reload();
        }
    };

    return (
        <Overlay onClick={onClose}>
            <div className="bg-black w-[90%] max-w-[320px] border border-[#333] animate-pop-in" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-[#333] bg-[#111]">
                    <h4 className="text-white font-bold text-sm">操作菜单</h4>
                </div>
                <button onClick={onUndo} className="w-full py-4 text-orange-500 font-bold text-sm hover:bg-[#111] transition-colors border-b border-[#222]">
                    撤销今日打卡
                </button>
                {/* 修正此处属性名: 从 handleReset 改为 onClick */}
                <button onClick={handleReset} className="w-full py-4 text-red-700 font-bold text-sm hover:bg-[#111] transition-colors">
                    重置所有数据 (Debug)
                </button>
                <button onClick={onClose} className="w-full py-4 text-gray-500 text-sm hover:bg-[#111] transition-colors border-t border-[#333]">
                    取消
                </button>
            </div>
        </Overlay>
    );
};

// --- History Modal ---
interface HistoryModalProps {
    date: string;
    record?: HistoryRecord;
    onClose: () => void;
}
export const HistoryModal: React.FC<HistoryModalProps> = ({ date, record, onClose }) => {
    const getExercises = (plan: 'upper' | 'lower') => PLANS[plan] || [];

    return (
        <Overlay onClick={onClose}>
            <div className="bg-black p-6 w-[85%] max-w-[320px] relative border border-[#333] animate-pop-in" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-white"><i className="fas fa-times"></i></button>
                <h3 className="text-white font-mono font-bold text-lg mb-6 border-l-2 border-accent pl-3">{date}</h3>
                
                <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
                    {!record ? (
                        <p className="text-gray-600 font-mono text-sm">暂无数据</p>
                    ) : (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 text-xs uppercase">类型</span>
                                <span className={`font-black uppercase italic text-xl ${record.type === 'rest' ? 'text-rest' : 'text-accent'}`}>
                                    {record.type === 'rest' ? '休息日' : '训练日'}
                                </span>
                            </div>
                            
                            {record.workoutPlan && (
                                 <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-gray-500 text-xs uppercase">部位</span>
                                        <span className="text-white font-bold uppercase">
                                            {record.workoutPlan === 'upper' ? '上半身' : '下半身'}
                                        </span>
                                    </div>
                                    <div className="bg-[#111] p-3 rounded border border-[#222]">
                                        <h4 className="text-[10px] text-gray-500 uppercase mb-2">训练内容</h4>
                                        <div className="space-y-1">
                                            {getExercises(record.workoutPlan).map(ex => {
                                                let completedText = null;
                                                let maxWeight = null;
                                                if (record.workoutSession && record.workoutSession[ex.id]) {
                                                    const session = record.workoutSession[ex.id];
                                                    const completedCount = session.filter(s => s.completed).length;
                                                    if (completedCount === 0) return null;
                                                    completedText = `${completedCount}组`;
                                                    const weights = session.filter(s => s.completed).map(s => parseFloat(s.weight || '0'));
                                                    if (weights.length > 0) maxWeight = Math.max(...weights);
                                                } else if (record.workoutSession) return null;

                                                return (
                                                    <div key={ex.id} className="text-sm text-gray-300 flex items-center justify-between gap-2 border-b border-[#222] pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                                                        <div className="flex items-center gap-2">
                                                            <i className="fas fa-dumbbell text-[10px] text-accent"></i>
                                                            <span>{ex.name}</span>
                                                        </div>
                                                        <div className="text-xs font-mono text-gray-500">
                                                            <span className="text-white font-bold">{completedText || '已打卡'}</span>
                                                            {maxWeight && <span className="ml-2 pl-2 border-l border-[#333]">{maxWeight}kg</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {record.diet && record.diet.length > 0 && (
                                <div className="pt-2 border-t border-[#222]">
                                    <h4 className="text-[10px] text-gray-600 uppercase mb-3 tracking-widest">饮食记录</h4>
                                    {record.diet.map((d, i) => (
                                        <div key={i} className="text-sm text-gray-300 mb-2 font-mono flex gap-2">
                                            <span className="text-accent">&gt;</span>
                                            <span>{d.text || "未填写"}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Overlay>
    );
};

// --- Celebration Layer ---
export const CelebrationLayer: React.FC<{ type: 'rest' | 'workout', onFinish: () => void }> = ({ type, onFinish }) => {
    const [active, setActive] = useState(false);
    useEffect(() => {
        const t1 = setTimeout(() => setActive(true), 100);
        const t2 = setTimeout(onFinish, 2500);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [onFinish]);

    return (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center animate-fade-in cursor-pointer" onClick={onFinish}>
             <div className="grid grid-cols-5 gap-1 p-2 bg-[#111] rounded-lg border border-[#333]">
                 {Array.from({ length: 25 }).map((_, i) => (
                     <div 
                        key={i} 
                        className={`w-8 h-8 rounded-sm transition-all duration-500 ${active ? (type === 'rest' ? 'bg-rest shadow-[0_0_20px_#00ccff]' : 'bg-accent shadow-[0_0_20px_#ccff00]') : 'bg-[#222] opacity-30'}`}
                        style={{ transitionDelay: `${Math.random() * 500}ms` }}
                     />
                 ))}
             </div>
             <div className="mt-8 text-center">
                 <h2 className={`text-2xl font-black italic text-white uppercase tracking-widest transition-opacity duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
                     {type === 'rest' ? 'RECOVERED' : 'FILLED UP'}
                 </h2>
                 <p className="text-[10px] text-gray-500 font-mono mt-2">点击继续</p>
             </div>
        </div>
    );
}
