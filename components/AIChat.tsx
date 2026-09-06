import React, { useEffect, useRef, useState } from 'react';
import { sendAIMessage } from '../services/aiApi';
import type { AIChatMessage, AIWorkoutContext } from '../types';

interface AIChatProps {
  context: AIWorkoutContext;
}

const AIChat: React.FC<AIChatProps> = ({ context }) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, error]);

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

  const dayLabel = context.workout?.isRecoveryDay
    ? '恢复日'
    : context.workout?.trainingDay ? `${context.workout.trainingDay} 日` : '同步中';

  return (
    <main className="h-[100dvh] max-w-[640px] mx-auto flex flex-col bg-black pb-[calc(70px+env(safe-area-inset-bottom))]">
      <header className="px-5 pt-[calc(20px+env(safe-area-inset-top))] pb-4 border-b border-[#202020] bg-black/95 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-accent text-[9px] font-mono tracking-[0.2em] mb-1">READ-ONLY COACH</div>
            <h1 className="text-white text-2xl font-black italic">AI 教练</h1>
          </div>
          <div className="text-right">
            <div className="px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-[10px] font-bold">今日 {dayLabel}</div>
            <p className="text-gray-700 text-[9px] mt-1">不修改 Notion 与未来计划</p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-3 no-scrollbar">
        {messages.length === 0 && (
          <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-accent/5 border border-accent/15 flex items-center justify-center mb-5"><i className="fas fa-shield-halved text-accent text-2xl" /></div>
            <h2 className="text-white font-black italic text-lg">你的只读训练副驾</h2>
            <p className="text-gray-600 text-xs leading-relaxed mt-2">可以根据今日计划和当前已输入的组数据回答动作、重量、次数、RIR 与恢复问题。</p>
            <div className="grid grid-cols-2 gap-2 mt-6 w-full max-w-[340px]">
              {['今天的训练重点？', '第 4 组该不该做？', '帮我检查当前组数', '这个动作哪里容易错？'].map((question) => (
                <button key={question} onClick={() => setInput(question)} className="rounded-xl bg-[#151515] border border-[#252525] p-3 text-left text-[10px] leading-relaxed text-gray-400 hover:border-accent/30 hover:text-white">{question}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${message.role === 'user' ? 'ml-auto bg-accent text-black rounded-br-sm' : 'bg-[#1c1c1c] border border-[#292929] text-gray-200 rounded-bl-sm'}`}>{message.content}</div>
        ))}
        {isSending && <div className="bg-[#1c1c1c] border border-[#292929] text-gray-500 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs w-fit animate-pulse">正在分析今日训练...</div>}
        {error && <div className="rounded-xl border border-orange-900/50 bg-orange-950/20 text-orange-300 text-xs p-3">{error}。训练页和本地草稿不受影响。</div>}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={submit} className="px-3 py-3 border-t border-[#222] bg-black/95 backdrop-blur-xl flex gap-2">
        <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000} placeholder="问一个训练问题..." className="flex-1 h-12 rounded-xl bg-[#181818] border border-[#303030] px-4 text-sm text-white outline-none focus:border-accent" />
        <button aria-label="发送消息" disabled={isSending || !input.trim()} className="w-12 h-12 rounded-xl bg-accent text-black disabled:opacity-30"><i className="fas fa-arrow-up" /></button>
      </form>
    </main>
  );
};

export default AIChat;
