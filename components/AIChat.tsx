import { ArrowLeft, ArrowUp, Bot, History, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { sendAIMessage } from '../services/aiApi';
import {
  conversationTitle,
  createConversation,
  listConversations,
  listMessages,
  removeConversation,
  saveConversation,
  sortConversations,
} from '../services/aiConversationStore';
import type { AIActionProposal, AIChatMessage, AIConversation, AIWorkoutContext } from '../types';
import { submitTrainingFeedback } from '../services/trainingFeedbackApi';

const ACTION_BLOCK_RE = /```action\s*\n([\s\S]*?)```/;

interface AIChatProps {
  context: AIWorkoutContext;
  reviewToken?: number;
}

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const AIChat: React.FC<AIChatProps> = ({ context, reviewToken = 0 }) => {
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [pendingProposal, setPendingProposal] = useState<AIActionProposal | null>(null);
  const [isWritingFeedback, setIsWritingFeedback] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, error]);

  useEffect(() => {
    let cancelled = false;
    const dailyTitle = `今日训练 · ${todayKey()}`;

    listConversations()
      .then(async (saved) => {
        if (cancelled) return;
        let nextConversations = saved;
        let dailyConversation = nextConversations.find((conversation) => conversation.type === 'daily-workout' && conversation.title === dailyTitle);

        if (!dailyConversation) {
          dailyConversation = { ...createConversation('daily-workout'), title: dailyTitle };
          nextConversations = sortConversations([dailyConversation, ...nextConversations]);
          await saveConversation(dailyConversation, []);
        }

        const dailyMessages = await listMessages(dailyConversation.id);
        if (cancelled) return;
        setConversations(nextConversations);
        setActiveId(dailyConversation.id);
        setMessages(dailyMessages.map((message) => ({ role: message.role, content: message.content })));
      })
      .catch(() => {
        if (cancelled) return;
        const conversation = createConversation('daily-workout');
        setConversations([{ ...conversation, title: dailyTitle }]);
        setActiveId(conversation.id);
        setMessages([]);
        setError('AI 对话本地存储不可用，本次内容可能无法保存。');
      })
      .finally(() => {
        if (!cancelled) setIsStorageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewToken]);

  const persistMessages = async (conversationId: string, nextMessages: AIChatMessage[]) => {
    const current = conversations.find((conversation) => conversation.id === conversationId);
    if (!current) return;

    const nextConversation = {
      ...current,
      title: current.type === 'daily-workout' ? current.title : conversationTitle(nextMessages),
      updatedAt: Date.now(),
    };

    setConversations((currentList) => sortConversations(
      currentList.map((conversation) => conversation.id === conversationId ? nextConversation : conversation)
    ));
    if (activeId === conversationId) setMessages(nextMessages);

    try {
      await saveConversation(nextConversation, nextMessages);
    } catch {
      setError('AI 对话本地保存失败，本次内容可能不会保留。');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || isSending || !activeId) return;

    const conversationId = activeId;
    const nextMessages: AIChatMessage[] = [...messages, { role: 'user', content }];
    setInput('');
    setError('');
    setIsSending(true);
    await persistMessages(conversationId, nextMessages);

    try {
      const reply = await sendAIMessage(nextMessages, context);
      const cleanReply = reply.replace(ACTION_BLOCK_RE, '').trim();
      const actionMatch = reply.match(ACTION_BLOCK_RE);
      let proposal: AIActionProposal | null = null;
      if (actionMatch) {
        try {
          const parsed = JSON.parse(actionMatch[1]) as Partial<AIActionProposal>;
          if (parsed.action === 'record_training_feedback' && typeof parsed.raw === 'string' && parsed.raw.trim()) {
            proposal = { ...parsed, action: 'record_training_feedback', raw: parsed.raw.trim() } as AIActionProposal;
          }
        } catch { /* ignore malformed proposal */ }
      }
      if (proposal) setPendingProposal(proposal);
      await persistMessages(conversationId, [...nextMessages, { role: 'assistant', content: cleanReply }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'AI 服务暂时不可用');
    } finally {
      setIsSending(false);
    }
  };

  const confirmProposal = async () => {
    if (!pendingProposal || isWritingFeedback) return;
    setIsWritingFeedback(true);
    setError('');
    try {
      await submitTrainingFeedback({ ...pendingProposal, date: todayKey() });
      setPendingProposal(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '训练反馈写入失败');
    } finally {
      setIsWritingFeedback(false);
    }
  };

  const cancelProposal = () => setPendingProposal(null);

  const switchConversation = async (conversationId: string) => {
    setActiveId(conversationId);
    setIsConversationOpen(false);
    try {
      const nextMessages = await listMessages(conversationId);
      setMessages(nextMessages.map((message) => ({ role: message.role, content: message.content })));
    } catch {
      setError('AI 对话读取失败，请稍后重试。');
    }
  };

  const createAndSelectConversation = async () => {
    if (isStorageLoading) return;
    const conversation = createConversation();
    setConversations((current) => sortConversations([conversation, ...current]));
    setActiveId(conversation.id);
    setMessages([]);
    setIsConversationOpen(false);

    try {
      await saveConversation(conversation, []);
    } catch {
      setError('AI 对话本地保存失败，本次内容可能不会保留。');
    }
  };

  const deleteConversation = async (id: string) => {
    const remaining = conversations.filter((conversation) => conversation.id !== id);
    setConversations(remaining);

    try {
      await removeConversation(id);
    } catch {
      setError('AI 对话删除失败，请稍后重试。');
    }

    if (remaining.length === 0) {
      await createAndSelectConversation();
      return;
    }
    if (activeId === id) await switchConversation(remaining[0].id);
  };

  const completedSets = Object.values(context.session).flat().filter((set) => set.completed).length;
  const totalSets = context.workout?.exercises.reduce((total, exercise) => total + exercise.planSets, 0) ?? 0;
  const dayLabel = context.workout?.isRecoveryDay
    ? '恢复日'
    : context.workout?.trainingDay ? `${context.workout.trainingDay} 日` : '同步中';

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[440px] flex-col bg-[#080808] pb-[calc(70px+env(safe-area-inset-bottom))]">
      <header className="border-b border-[#242426] bg-[#0E0E0E]/95 px-4 pb-3 pt-[calc(14px+env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><ArrowLeft size={18} className="text-[#8B93A3]" /><h1 className="text-lg font-black text-[#F5F5F5]">AI 教练</h1></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsConversationOpen(true)} aria-label="对话列表" className="flex h-9 items-center gap-1 rounded-xl bg-[#1B1B1B] px-2.5 text-[10px] text-[#8B93A3]"><History size={14} />历史</button>
            <button onClick={() => void createAndSelectConversation()} aria-label="新对话" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1B1B1B] text-[#F5F5F5]"><Plus size={16} /></button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-full bg-[#151515] px-3 py-2 text-[10px] text-[#8B93A3]"><span><span className="mr-2 text-[#9EFF3F]">●</span>训练进行中 · {completedSets}/{totalSets} 组 · 当前 {dayLabel}</span><span className="font-bold text-[#9EFF3F]">LIVE</span></div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-3 no-scrollbar">
        {messages.length === 0 && (
          <div className="min-h-[360px] px-1 pt-1">
            <div className="flex items-start gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#26351B] text-[#9EFF3F]"><Bot size={16} /></span>
              <div className="rounded-2xl rounded-tl-sm bg-[#1C1C1E] p-4 text-xs leading-5 text-[#D1D5DB]">
                <p>根据你的训练历史和今天的状态，我可以帮你：</p>
                <ul className="mt-2 space-y-1 text-[#8B93A3]"><li>· 制定训练策略</li><li>· 分析动作表现</li><li>· 给出训练重量建议</li><li>· 解答训练问题</li></ul>
              </div>
            </div>
            <p className="mb-2 mt-4 text-[10px] font-bold text-[#8B93A3]">你可以问我：</p>
            <div className="flex flex-wrap gap-2">
              {['今天的训练重点？', '第 4 组该不该做？', '帮我检查当前组数', '这个动作哪里容易错？'].map((question) => (
                <button key={question} onClick={() => setInput(question)} className="rounded-full bg-[#151515] px-3 py-2 text-left text-[10px] text-[#8B93A3] hover:text-white">{question}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${message.role === 'user' ? 'ml-auto bg-accent text-black rounded-br-sm' : 'bg-[#1c1c1c] border border-[#292929] text-gray-200 rounded-bl-sm'}`}>{message.content}</div>
        ))}
        {pendingProposal && (
          <div className='max-w-[86%] rounded-2xl border border-accent/30 bg-accent/5 p-3.5'>
            <p className='text-accent text-[9px] font-mono tracking-[0.15em] mb-2'>训练反馈写入确认</p>
            <div className='space-y-1 text-xs text-gray-300'>
              {pendingProposal.exerciseName && <p>动作：{pendingProposal.exerciseName}</p>}
              {pendingProposal.bodyPart && <p>部位：{pendingProposal.bodyPart}</p>}
              {pendingProposal.severity != null && <p>严重度：{pendingProposal.severity}/10</p>}
              <p className='text-gray-500 text-[10px]'>原文：{pendingProposal.raw}</p>
            </div>
            <div className='flex gap-2 mt-3'>
              <button onClick={() => void confirmProposal()} disabled={isWritingFeedback} className='flex-1 h-9 rounded-lg bg-accent text-black text-xs font-bold disabled:opacity-30'>{isWritingFeedback ? '写入中...' : '写入 Notion'}</button>
              <button onClick={cancelProposal} disabled={isWritingFeedback} className='flex-1 h-9 rounded-lg border border-[#303030] text-gray-400 text-xs disabled:opacity-30'>取消</button>
            </div>
          </div>
        )}
        {isSending && <div className="bg-[#1c1c1c] border border-[#292929] text-gray-500 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs w-fit animate-pulse">正在分析今日训练...</div>}
        {error && <div className="rounded-xl border border-orange-900/50 bg-orange-950/20 text-orange-300 text-xs p-3">{error}。训练页和本地草稿不受影响。</div>}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-[#242426] bg-[#0E0E0E]/95 px-3 py-3 backdrop-blur-xl">
        <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000} placeholder="问教练..." className="h-12 flex-1 rounded-full bg-[#1B1B1B] px-4 text-sm text-white outline-none focus:ring-1 focus:ring-[#9EFF3F]" />
        <button aria-label="发送消息" disabled={isSending || !input.trim()} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#9EFF3F] text-[#080808] disabled:opacity-30"><ArrowUp size={19} /></button>
      </form>

      {isConversationOpen && (
        <div className="fixed inset-0 z-[120] bg-black/80" onClick={() => setIsConversationOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 max-h-[72dvh] rounded-t-2xl border-t border-[#252525] bg-black px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-4" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto flex w-full max-w-[440px] items-center justify-between">
              <h2 className="text-lg font-black text-white">对话</h2>
              <button onClick={() => void createAndSelectConversation()} disabled={isStorageLoading} className="rounded-xl bg-accent px-3 py-2 text-xs font-black text-black disabled:opacity-40">新对话</button>
            </div>
            <div className="mx-auto mt-4 max-h-[48dvh] w-full max-w-[440px] space-y-2 overflow-y-auto no-scrollbar">
              {conversations.map((conversation) => (
                <div key={conversation.id} className="flex items-center gap-2 rounded-xl border border-[#262626] bg-[#151515] p-3">
                  <button onClick={() => void switchConversation(conversation.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-bold text-white">{conversation.title}</p>
                    <p className="mt-1 text-[10px] text-gray-500">{conversation.type === 'daily-workout' ? '今日训练' : '普通对话'}</p>
                  </button>
                  <button onClick={() => void deleteConversation(conversation.id)} aria-label={`删除 ${conversation.title}`} className="h-9 w-9 shrink-0 rounded-lg bg-[#1a1a1a] text-gray-500">
                    <Trash2 className="text-xs" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default AIChat;
