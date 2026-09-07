import type { AIChatMessage, AIConversation, AIConversationSnapshot, AIConversationType, AIStoredMessage } from '../types';

const DB_NAME = 'keep-fit-ai';
const DB_VERSION = 2;
const CONVERSATIONS_STORE = 'conversations';
const MESSAGES_STORE = 'messages';

const openDatabase = () => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable'));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        database.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(MESSAGES_STORE)) {
        const messageStore = database.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
        messageStore.createIndex('conversationId', 'conversationId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB is unavailable'));
  });
};

const requestDone = <T,>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  });

const withTransaction = async <T,>(
  storeNames: string[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => Promise<T>,
) => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeNames, mode);
    const result = await operation(transaction);
    await transactionDone(transaction);
    return result;
  } finally {
    database.close();
  }
};

const withStore = async <T,>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) => withTransaction([CONVERSATIONS_STORE], mode, (transaction) => requestDone(operation(transaction.objectStore(CONVERSATIONS_STORE))));

const normalizeMessage = (value: unknown, conversationId: string, index: number): AIStoredMessage | null => {
  const item = (value || {}) as Partial<AIStoredMessage>;
  const content = typeof item.content === 'string' ? item.content.trim() : '';
  if (!content) return null;

  const createdAt = typeof item.createdAt === 'number' ? item.createdAt : Date.now();
  return {
    id: typeof item.id === 'string' && item.id ? item.id : `${conversationId}-${createdAt}-${index}-${Math.random().toString(16).slice(2)}`,
    conversationId,
    role: item.role === 'assistant' ? 'assistant' : 'user',
    content,
    createdAt,
  };
};

const normalizeMessages = (value: unknown, conversationId: string) =>
  Array.isArray(value)
    ? value.flatMap((item, index) => {
        const message = normalizeMessage(item, conversationId, index);
        return message ? [message] : [];
      })
    : [];

export const conversationTitle = (messages: Pick<AIChatMessage, 'role' | 'content'>[]) => {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const title = firstUserMessage?.content.split(/\r?\n/)[0].trim() || '新对话';
  return title.length > 20 ? title.slice(0, 20) + '...' : title;
};

export const normalizeConversation = (value: unknown): AIConversation => {
  const item = (value || {}) as Partial<AIConversation> & { messages?: unknown };
  const createdAt = typeof item.createdAt === 'number' ? item.createdAt : Date.now();
  const id = typeof item.id === 'string' && item.id ? item.id : 'ai-' + createdAt + '-' + Math.random().toString(16).slice(2);
  const legacyMessages = normalizeMessages(item.messages, id).map((message) => ({ role: message.role, content: message.content }));

  return {
    id,
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : conversationTitle(legacyMessages),
    type: item.type === 'daily-workout' ? 'daily-workout' : 'general',
    createdAt,
    updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : createdAt,
  };
};

export const sortConversations = (conversations: AIConversation[]) =>
  [...conversations].sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt);

export const createConversation = (type: AIConversationType = 'general'): AIConversation => {
  const now = Date.now();
  const random = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(16).slice(2);
  return { id: 'ai-' + now + '-' + random, title: '新对话', type, createdAt: now, updatedAt: now };
};

export const listConversations = async () => {
  const records = await withStore('readonly', (store) => store.getAll());
  return sortConversations(records.map((record) => normalizeConversation(record)));
};

export const listMessages = async (conversationId: string) => {
  const records = await withTransaction([MESSAGES_STORE], 'readonly', async (transaction) => {
    const index = transaction.objectStore(MESSAGES_STORE).index('conversationId');
    return requestDone(index.getAll(IDBKeyRange.only(conversationId)));
  });

  return records
    .map((record, index) => normalizeMessage(record, conversationId, index))
    .filter((message): message is AIStoredMessage => Boolean(message))
    .sort((left, right) => left.createdAt - right.createdAt);
};

export const saveConversation = async (conversation: AIConversation, messages: AIChatMessage[] = []) => {
  const normalizedConversation = normalizeConversation(conversation);
  const normalizedMessages = normalizeMessages(messages, normalizedConversation.id);

  await withTransaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readwrite', async (transaction) => {
    const messageStore = transaction.objectStore(MESSAGES_STORE);
    const existing = await requestDone(messageStore.index('conversationId').getAll(IDBKeyRange.only(normalizedConversation.id)));
    existing.forEach((message) => messageStore.delete(message.id));
    normalizedMessages.forEach((message) => messageStore.put(message));
    transaction.objectStore(CONVERSATIONS_STORE).put(normalizedConversation);
  });
};

export const removeConversation = async (id: string) => {
  await withTransaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readwrite', async (transaction) => {
    const messageStore = transaction.objectStore(MESSAGES_STORE);
    const existing = await requestDone(messageStore.index('conversationId').getAll(IDBKeyRange.only(id)));
    existing.forEach((message) => messageStore.delete(message.id));
    transaction.objectStore(CONVERSATIONS_STORE).delete(id);
  });
};

export const clearConversations = async () => {
  await withTransaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readwrite', async (transaction) => {
    transaction.objectStore(CONVERSATIONS_STORE).clear();
    transaction.objectStore(MESSAGES_STORE).clear();
  });
};

export const exportConversations = async (): Promise<AIConversationSnapshot> => {
  const [conversations, messages] = await withTransaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readonly', async (transaction) => {
    const conversationRecords = await requestDone(transaction.objectStore(CONVERSATIONS_STORE).getAll());
    const messageRecords = await requestDone(transaction.objectStore(MESSAGES_STORE).getAll());
    return [conversationRecords, messageRecords] as const;
  });

  return {
    conversations: conversations.map((record) => normalizeConversation(record)),
    messages: messages
      .map((record, index) => normalizeMessage(record, String((record as Partial<AIStoredMessage>)?.conversationId || ''), index))
      .filter((message): message is AIStoredMessage => Boolean(message)),
  };
};

export const replaceConversations = async (snapshot: AIConversationSnapshot) => {
  const conversations = Array.isArray(snapshot?.conversations) ? snapshot.conversations.map((record) => normalizeConversation(record)) : [];
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  const messages = Array.isArray(snapshot?.messages)
    ? snapshot.messages.flatMap((message, index) => {
        if (!conversationIds.has(message.conversationId)) return [];
        const normalized = normalizeMessage(message, message.conversationId, index);
        return normalized ? [normalized] : [];
      })
    : [];

  await withTransaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readwrite', async (transaction) => {
    const conversationStore = transaction.objectStore(CONVERSATIONS_STORE);
    const messageStore = transaction.objectStore(MESSAGES_STORE);
    conversationStore.clear();
    messageStore.clear();
    conversations.forEach((conversation) => conversationStore.put(conversation));
    messages.forEach((message) => messageStore.put(message));
  });
};
