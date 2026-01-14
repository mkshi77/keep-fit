
import React from 'react';
import { DietItem } from '../types';
import { FOOD_LIB } from '../constants';

interface DietSectionProps {
    items: DietItem[];
    setItems: (items: DietItem[]) => void;
    onFeedback: (x: number, y: number, type: 'diet' | 'workout') => void;
}

const DietSection: React.FC<DietSectionProps> = ({ items, setItems, onFeedback }) => {
    const updateItem = (id: number, field: keyof DietItem, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleCheck = (e: React.MouseEvent, id: number, currentChecked: boolean) => {
        updateItem(id, 'checked', !currentChecked);
        if (!currentChecked) {
            onFeedback(e.clientX - 60, e.clientY - 40, 'diet');
        }
    };

    const removeItem = (id: number) => {
        setItems(items.filter(item => item.id !== id));
    };

    const addItem = () => {
        setItems([...items, {
            id: Date.now(),
            time: '21:00',
            text: '',
            checked: false,
            required: false
        }]);
    };

    const fillRandom = (id: number) => {
        const randomFood = FOOD_LIB[Math.floor(Math.random() * FOOD_LIB.length)];
        updateItem(id, 'text', randomFood);
    };

    return (
        <section className="mb-5">
            <div className="flex justify-between items-center mb-2.5">
                <h2 className="text-white font-black text-base italic flex items-center gap-2 tracking-wide">
                    <i className="fas fa-bolt text-accent text-sm"></i>
                    加餐充能
                </h2>
                <button
                    onClick={addItem}
                    className="w-7 h-7 flex items-center justify-center text-gray-600 border border-[#222] rounded-md hover:border-accent hover:text-white transition-all active:scale-90"
                >
                    <i className="fas fa-plus text-[10px]"></i>
                </button>
            </div>

            <div className="space-y-2">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`relative overflow-hidden bg-[#0a0a0a] p-3 rounded-xl border transition-all duration-300 ${item.checked ? 'border-accent/20 bg-black' : 'border-[#161616]'
                            }`}
                    >
                        {item.checked && (
                            <div className="absolute top-0 left-0 w-0.5 h-full bg-accent shadow-[0_0_5px_#ccff00]"></div>
                        )}

                        <div className="flex justify-between items-center gap-3">
                            <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center gap-0 relative">
                                    {/* Make icon clickable to trigger picker */}
                                    <i
                                        className="far fa-clock text-sm text-gray-500 hover:text-accent cursor-pointer p-1 active:scale-90 transition-all"
                                        onClick={() => {
                                            const input = document.getElementById(`time-input-${item.id}`) as HTMLInputElement;
                                            if (input) {
                                                if ('showPicker' in HTMLInputElement.prototype) {
                                                    try {
                                                        input.showPicker();
                                                    } catch (err) {
                                                        input.focus();
                                                    }
                                                } else {
                                                    input.focus();
                                                    input.click();
                                                }
                                            }
                                        }}
                                    ></i>
                                    <input
                                        id={`time-input-${item.id}`}
                                        type="time"
                                        className="bg-transparent text-accent font-mono text-base font-black outline-none p-0 border-none w-[85px] leading-none text-center relative z-10"
                                        value={item.time}
                                        onChange={(e) => updateItem(item.id, 'time', e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        className={`bg-transparent flex-1 outline-none transition-all text-[11px] font-bold ${item.checked ? 'text-gray-700 line-through italic' : 'text-gray-300'
                                            } placeholder-gray-800`}
                                        placeholder="输入增肌燃料..."
                                        value={item.text}
                                        onChange={(e) => updateItem(item.id, 'text', e.target.value)}
                                    />
                                    {!item.checked && (
                                        <button onClick={() => fillRandom(item.id)} className="text-gray-700 hover:text-accent p-1">
                                            <i className="fas fa-wand-magic-sparkles text-[10px]"></i>
                                        </button>
                                    )}
                                    {!item.required && !item.checked && (
                                        <button onClick={() => removeItem(item.id)} className="text-gray-800 hover:text-red-900 p-1">
                                            <i className="fas fa-trash text-[9px]"></i>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={(e) => handleCheck(e, item.id, item.checked)}
                                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 shrink-0 ${item.checked
                                    ? 'bg-accent border-accent shadow-[0_0_8px_rgba(204,255,0,0.3)]'
                                    : 'border-[#222] bg-transparent'
                                    }`}
                            >
                                {item.checked && (
                                    <i className="fas fa-check text-black text-[9px]"></i>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section >
    );
};

export default DietSection;
