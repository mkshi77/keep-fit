import type { WorkoutReviewPayload } from "../../types.js";
import { authFailure } from "../../server/auth.js";
import { clientRateLimitKey, consumeRateLimit } from "../../server/rate-limit.js";
import { isAllowedBrowserOrigin, type ApiRequest, type ApiResponse } from "../../server/http.js";
import { chatCompletionUrl, providerConfig } from "./chat.js";

interface ReviewBody {
  summary?: WorkoutReviewPayload;
}

const boundedString = (value: unknown, maxLength: number) =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength ? value : null;

const validSet = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const set = value as Record<string, unknown>;
  return typeof set.completed === "boolean"
    && (set.weight == null || typeof set.weight === "string" && set.weight.length <= 20)
    && (set.reps == null || typeof set.reps === "string" && set.reps.length <= 20);
};

const validFeedback = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const feedback = value as Record<string, unknown>;
  return (feedback.rir == null || typeof feedback.rir === "number" && Number.isFinite(feedback.rir) && feedback.rir >= 0 && feedback.rir <= 10)
    && (feedback.asymmetry == null || feedback.asymmetry === 0 || feedback.asymmetry === 1 || feedback.asymmetry === 2 || feedback.asymmetry === 3)
    && (feedback.discomfort == null || typeof feedback.discomfort === "number" && Number.isFinite(feedback.discomfort) && feedback.discomfort >= 0 && feedback.discomfort <= 10);
};

const validSummary = (value: unknown): value is WorkoutReviewPayload => {
  if (!value || typeof value !== "object") return false;
  const summary = value as Record<string, unknown>;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(summary.date || ""))) return false;
  if (!["A", "B", "C"].includes(String(summary.trainingDay))) return false;
  if (summary.durationMinutes != null && (typeof summary.durationMinutes !== "number" || !Number.isFinite(summary.durationMinutes) || summary.durationMinutes < 0 || summary.durationMinutes > 600)) return false;
  if (!Array.isArray(summary.exercises) || summary.exercises.length === 0 || summary.exercises.length > 20) return false;

  let hasCompletedSet = false;
  for (const item of summary.exercises) {
    if (!item || typeof item !== "object") return false;
    const exercise = item as Record<string, unknown>;
    if (!boundedString(exercise.exerciseId, 120) || !boundedString(exercise.name, 120)) return false;
    if (!Array.isArray(exercise.sets) || exercise.sets.length === 0 || exercise.sets.length > 12) return false;
    if (!validFeedback(exercise.feedback)) return false;
    for (const set of exercise.sets) {
      if (!validSet(set)) return false;
      if ((set as { completed?: boolean }).completed) hasCompletedSet = true;
    }
  }
  return hasCompletedSet;
};

const systemPrompt = (summary: WorkoutReviewPayload) => `你是 Keep Fit 的训练复盘教练。
请基于用户提交的训练数据给出简洁、正向、数据驱动的中文复盘。
要求：
- 100 到 160 个汉字。
- 适度使用 💪🔥🏋️ 等表情。
- 提到完成的动作、组数、重量或次数亮点。
- 给出下一次训练的一个可执行建议。
- 不要声称写入 Notion 或修改训练计划。
- 如有疼痛或高风险信号，建议寻求专业帮助。

训练数据：
${JSON.stringify(summary, null, 2).slice(0, 12000)}`;

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!isAllowedBrowserOrigin(request)) return response.status(403).json({ error: "不允许的请求来源" });
  const failure = authFailure(request);
  if (failure) return response.status(failure.status).json(failure);

  const rate = consumeRateLimit(clientRateLimitKey(request.headers));
  if (!rate.allowed) {
    response.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return response.status(429).json({ error: "AI 请求过于频繁，请稍后再试" });
  }

  const config = providerConfig();
  if (!config) return response.status(503).json({ error: "AI 尚未配置" });

  const body = (request.body ?? {}) as ReviewBody;
  if (!validSummary(body.summary)) return response.status(400).json({ error: "训练数据格式无效" });

  try {
    const upstream = await fetch(chatCompletionUrl(config.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt(body.summary) },
          { role: "user", content: "请生成训练复盘。" },
        ],
      }),
    });
    const data = await upstream.json().catch(() => null) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    if (!upstream.ok) {
      console.error("AI provider request failed", upstream.status, data?.error?.message ?? "unknown");
      return response.status(502).json({ error: "AI 服务暂时不可用" });
    }
    const review = data?.choices?.[0]?.message?.content;
    if (!review) return response.status(502).json({ error: "AI 返回了空响应" });
    return response.status(200).json({ content: review, provider: config.provider });
  } catch (error) {
    console.error("AI workout review failed", error instanceof Error ? error.message : error);
    return response.status(502).json({ error: "AI 服务连接失败" });
  }
}
