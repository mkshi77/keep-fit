import type { AIChatMessage, AIWorkoutContext } from '../../types.js';
import { authFailure } from '../../server/auth.js';
import { clientRateLimitKey, consumeRateLimit } from '../../server/rate-limit.js';
import { isAllowedBrowserOrigin, type ApiRequest, type ApiResponse } from '../../server/http.js';

type Provider = 'deepseek' | 'glm';

interface ChatBody {
  messages?: AIChatMessage[];
  context?: AIWorkoutContext;
}

export const chatCompletionUrl = (baseUrl: string) => {
  const clean = baseUrl.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(clean)) return clean;
  if (/\/v1$/i.test(clean)) return `${clean}/chat/completions`;
  return `${clean}/v1/chat/completions`;
};

export const providerConfig = () => {
  const provider = process.env.AI_PROVIDER?.toLowerCase() as Provider | undefined;
  if (!provider || !['deepseek', 'glm'].includes(provider)) return null;
  const prefix = provider === 'deepseek' ? 'DEEPSEEK' : 'GLM';
  const baseUrl = process.env[`${prefix}_BASE_URL`];
  const apiKey = process.env[`${prefix}_API_KEY`];
  const model = process.env[`${prefix}_MODEL`];
  if (!baseUrl || !apiKey || !model) return null;
  return { provider, baseUrl, apiKey, model };
};

const validMessages = (messages: unknown): messages is AIChatMessage[] =>
  Array.isArray(messages)
  && messages.length > 0
  && messages.length <= 20
  && messages.every((message) => message
    && typeof message === 'object'
    && ['user', 'assistant'].includes((message as AIChatMessage).role)
    && typeof (message as AIChatMessage).content === 'string'
    && (message as AIChatMessage).content.length <= 4000);

const systemPrompt = (context?: AIWorkoutContext) => `你是 Keep Fit 的训练问答助手。
你可以回答训练问题，并参考“今日训练”和用户当前已输入的组数据。
你不能调用 Notion，不能修改未来训练计划，不能删除记录，也不能声称已执行任何写操作。
如遇明显伤痛或高风险症状，建议停止动作并寻求合格医疗或训练专业人士帮助。

今日上下文（只读）：
${JSON.stringify(context ?? {}, null, 2).slice(0, 12000)}`;

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAllowedBrowserOrigin(request)) return response.status(403).json({ error: '不允许的请求来源' });
  const failure = authFailure(request);
  if (failure) return response.status(failure.status).json(failure);

  const rate = consumeRateLimit(clientRateLimitKey(request.headers));
  if (!rate.allowed) {
    response.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return response.status(429).json({ error: 'AI 请求过于频繁，请稍后再试' });
  }

  const config = providerConfig();
  if (!config) return response.status(503).json({ error: 'AI 尚未配置' });

  const body = (request.body ?? {}) as ChatBody;
  if (!validMessages(body.messages)) return response.status(400).json({ error: '消息格式无效' });

  try {
    const upstream = await fetch(chatCompletionUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt(body.context) },
          ...body.messages,
        ],
      }),
    });
    const data = await upstream.json().catch(() => null) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    if (!upstream.ok) {
      console.error('AI provider request failed', upstream.status, data?.error?.message ?? 'unknown');
      return response.status(502).json({ error: 'AI 服务暂时不可用' });
    }
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return response.status(502).json({ error: 'AI 返回了空响应' });
    return response.status(200).json({ content, provider: config.provider });
  } catch (error) {
    console.error('AI chat failed', error instanceof Error ? error.message : error);
    return response.status(502).json({ error: 'AI 服务连接失败' });
  }
}


