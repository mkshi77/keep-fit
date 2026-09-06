import React, { useState } from 'react';
import { sendAIMessage } from '../services/aiApi';
import type { AIChatMessage, AIWorkoutContext } from '../types';

interface AIChatProps {
  context: AIWorkoutContext;
}

const AIChat: React.FC<AIChatProps> = ({ context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || isSending) return;
    const nextMessages: AIChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setIsSending(true);
    try {
      const reply = await sendAIMessage(nextMessages, context);
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'AI 服务暂时不可用');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} aria-label="打开训练 AI" className="fixed right-4 bottom-[92px] z-[70] w-12 h-12 rounded-full bg-[#181818] border border-accent/40 text-accent shadow-[0_0_18px_rgba(204,255,0,0.18)]"><i className="fas fa-message" /></button>
      {isOpen && (
        <div className="fixed inset-0 z-[180] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center" onClick={() => setIsOpen(false)}>
          <div className="w-full sm:max-w-[420px] h-[72vh] sm:h-[620px] bg-[#111] border border-[#292929] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="p-4 border-b border-[#252525] flex justify-between items-center"><div><h2 className="font-black italic text-white">训练 AI</h2><p className="text-[9px] text-gray-600 mt-0.5">只读今日上下文 · 不修改训练计划</p></div><button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-[#222] text-gray-500"><i className="fas fa-times" /></button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {messages.length === 0 && <div className="text-center text-gray-600 text-xs mt-16"><i className="fas fa-shield-halved text-accent/50 text-2xl mb-3 block" />可询问动作、组数、RIR 或今天已输入的数据。</div>}
              {messages.map((message, index) => <div key={index} className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${message.role === 'user' ? 'ml-auto bg-accent text-black' : 'bg-[#202020] text-gray-200'}`}>{message.content}</div>)}
              {isSending && <div className="bg-[#202020] text-gray-500 rounded-2xl px-3 py-2 text-xs w-fit animate-pulse">正在思考...</div>}
              {error && <div className="rounded-xl border border-orange-900/50 bg-orange-950/20 text-orange-300 text-xs p-3">{error}。App 其他功能不受影响。</div>}
            </div>
            <form onSubmit={submit} className="p-3 border-t border-[#252525] flex gap-2 pb-[calc(12px+env(safe-area-inset-bottom))]">
              <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000} placeholder="问一个训练问题..." className="flex-1 h-11 rounded-xl bg-[#1b1b1b] border border-[#303030] px-3 text-sm text-white outline-none focus:border-accent" />
              <button disabled={isSending || !input.trim()} className="w-11 h-11 rounded-xl bg-accent text-black disabled:opacity-30"><i className="fas fa-arrow-up" /></button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChat;
