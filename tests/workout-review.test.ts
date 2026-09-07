import { describe, expect, it, vi } from "vitest";
import { createSessionCookie } from "../server/auth";
import { resetRateLimits } from "../server/rate-limit";
import reviewHandler from "../api/ai/workout-review";
import type { ApiResponse, ApiRequest } from "../server/http";

const mockResponse = () => {
  const state: { status?: number; body?: unknown; headers: Record<string, string> } = { headers: {} };
  const response: ApiResponse = {
    setHeader: (name, value) => { state.headers[name] = value; },
    status: (code) => { state.status = code; return response; },
    json: (body) => { state.body = body; return body; },
  };
  return { response, state };
};

const withEnv = async (values: Record<string, string | undefined>, fn: () => Promise<void>) => {
  const saved = new Map(Object.entries(values).map(([key, value]) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const summary = {
  date: "2026-09-07",
  trainingDay: "A" as const,
  durationMinutes: 52,
  exercises: [{
    exerciseId: "leg_press",
    name: "腿举",
    sets: [{ weight: "80", reps: "10", completed: true }],
    feedback: { rir: 2, asymmetry: 0 as const, discomfort: 0 },
  }],
};

describe("workout review API", () => {
  it("fails closed without AI provider configuration", async () => {
    resetRateLimits();
    await withEnv({
      APP_ACCESS_PASSWORD: "test-password",
      AI_PROVIDER: undefined,
    }, async () => {
      const { response, state } = mockResponse();
      await reviewHandler({
        method: "POST",
        headers: {
          origin: "http://localhost.test",
          host: "localhost.test",
          cookie: createSessionCookie("test-password"),
        },
        body: { summary },
      }, response);
      expect(state.status).toBe(503);
    });
  });

  it("rejects invalid training data before calling the provider", async () => {
    resetRateLimits();
    const provider = vi.fn();
    global.fetch = provider as unknown as typeof fetch;
    await withEnv({
      APP_ACCESS_PASSWORD: "test-password",
      AI_PROVIDER: "deepseek",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_MODEL: "test-model",
    }, async () => {
      const { response, state } = mockResponse();
      await reviewHandler({
        method: "POST",
        headers: {
          origin: "http://localhost.test",
          host: "localhost.test",
          cookie: createSessionCookie("test-password"),
        },
        body: { summary: { ...summary, exercises: [{ ...summary.exercises[0], sets: [{ weight: "", reps: "", completed: false }] }] } },
      }, response);
      expect(state.status).toBe(400);
      expect(provider).not.toHaveBeenCalled();
    });
  });

  it("returns provider review content", async () => {
    resetRateLimits();
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "今天完成得很好，下次保持节奏。💪" } }] }),
    })) as unknown as typeof fetch;
    await withEnv({
      APP_ACCESS_PASSWORD: "test-password",
      AI_PROVIDER: "deepseek",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_MODEL: "test-model",
    }, async () => {
      const { response, state } = mockResponse();
      await reviewHandler({
        method: "POST",
        headers: {
          origin: "http://localhost.test",
          host: "localhost.test",
          cookie: createSessionCookie("test-password"),
        },
        body: { summary },
      } satisfies ApiRequest, response);
      expect(state.status).toBe(200);
      expect(state.body).toMatchObject({ content: "今天完成得很好，下次保持节奏。💪" });
    });
  });
});
