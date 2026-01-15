import React, { useRef } from 'react';
import { DB_KEY } from '../constants';

interface DataManagementProps {
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ onClose, onSuccess, onError }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        try {
            const data = localStorage.getItem(DB_KEY);
            if (!data) {
                onError('没有数据可导出');
                return;
            }

            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `keep-fit-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            onSuccess('数据导出成功！');
        } catch (err) {
            onError('导出失败，请重试');
        }
    };

    const handleImport = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const data = JSON.parse(content);

                // 验证数据结构
                if (!data.lastLogin || !data.history) {
                    throw new Error('Invalid data format');
                }

                localStorage.setItem(DB_KEY, content);
                onSuccess('数据导入成功！请刷新页面');
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                onError('导入失败，文件格式不正确');
            }
        };
        reader.readAsText(file);
    };

    const handleClearData = () => {
        if (window.confirm('确定要清除所有数据吗？此操作不可恢复！')) {
            localStorage.removeItem(DB_KEY);
            onSuccess('数据已清除，页面即将刷新');
            setTimeout(() => window.location.reload(), 1500);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 backdrop-blur-xl">
            <div className="absolute inset-0" onClick={onClose}></div>

            <div className="bg-[#121212] w-full max-w-[360px] rounded-2xl border border-[#222] relative z-10 shadow-2xl overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-[#222]">
                    <div className="flex justify-between items-center">
                        <h2 className="text-white font-black text-lg italic">数据管理</h2>
                        <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#222] text-gray-500 hover:text-white transition-colors flex items-center justify-center">
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-3">
                    <button
                        onClick={handleExport}
                        className="w-full bg-accent text-black font-bold py-3.5 rounded-xl hover:bg-white transition-all shadow-[0_0_15px_rgba(204,255,0,0.2)] active:scale-95 flex items-center justify-center gap-2"
                    >
                        <i className="fas fa-download"></i>
                        导出数据
                    </button>

                    <button
                        onClick={handleImport}
                        className="w-full bg-[#222] text-white font-bold py-3.5 rounded-xl hover:bg-[#333] transition-all active:scale-95 flex items-center justify-center gap-2 border border-[#333]"
                    >
                        <i className="fas fa-upload"></i>
                        导入数据
                    </button>

                    <button
                        onClick={handleClearData}
                        className="w-full bg-transparent text-red-500 font-bold py-3.5 rounded-xl hover:bg-red-500/10 transition-all active:scale-95 flex items-center justify-center gap-2 border border-red-500/30"
                    >
                        <i className="fas fa-trash"></i>
                        清除所有数据
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    <div className="mt-4 p-3 bg-accent/5 border border-accent/10 rounded-lg">
                        <p className="text-accent/80 text-xs leading-relaxed">
                            <i className="fas fa-info-circle mr-1"></i>
                            导出的数据文件包含所有训练记录、体重数据和饮食记录。建议定期备份。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataManagement;
