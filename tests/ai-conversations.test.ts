import { describe, expect, it } from 'vitest';
import { conversationTitle, normalizeConversation, sortConversations } from '../services/aiConversationStore';
import type { AIConversation } from '../types';

describe('AI conversations', () => {
  it('normalizes persisted conversations and drops invalid messages', () => {
    const conversation = normalizeConversation({
      id: 'conversation-1',
      createdAt: 20,
      updatedAt: 30,
      messages: [
        { role: 'user', content: ' 今天的训练重点？ ' },
        { role: 'assistant', content: '' },
        { role: 'unknown', content: '仍然按用户消息保存' },
      ],
    });

    expect(conversation.title).toBe('今天的训练重点？');
    expect(conversation.type).toBe('general');
  });

  it('uses a short first line as the conversation title', () => {
    const longTitle = conversationTitle([{ role: 'user', content: `${'x'.repeat(21)}\nsecond line` }]);

    expect(longTitle).toBe(`${'x'.repeat(20)}...`);
  });

  it('sorts conversations by recent activity', () => {
    const conversations = sortConversations([
      { id: 'old', title: 'Old', type: 'general', createdAt: 1, updatedAt: 1 } as AIConversation,
      { id: 'new', title: 'New', type: 'general', createdAt: 2, updatedAt: 3 } as AIConversation,
    ]);

    expect(conversations.map((conversation) => conversation.id)).toEqual(['new', 'old']);
  });
});
