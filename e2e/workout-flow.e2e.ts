import { test, expect, type Page } from '@playwright/test';

const plan = {
  // Deliberately differs from the browser's date: the server workout date is canonical.
  date: '2030-01-07', trainingDay: 'A', isRecoveryDay: false, source: 'notion',
  exercises: [
    { exerciseId: 'bench', notionPageId: 'bench-page', name: '史密斯平板卧推', planSets: 2, planReps: '8–10', planWeight: '40 kg' },
    { exerciseId: 'row', notionPageId: 'row-page', name: '坐姿绳索划船', planSets: 2, planReps: '10–12', planWeight: '45 kg' },
  ],
};

async function setup(page: Page, options: { recovery?: boolean; completed?: boolean; draft?: boolean; review?: boolean; failSave?: boolean | number } = {}) {
  const calls: { submissions: any[]; reviews: number } = { submissions: [], reviews: 0 };
  await page.addInitScript(({ completed, draft, review, businessDate, cachedPlan }) => {
    if (localStorage.getItem('e2e-seeded')) return;
    const now = new Date();
    const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    localStorage.setItem('FILLUP_2026_V26_STABLE', JSON.stringify({
      lastLogin: now.toDateString(), history: {
        ...(completed ? { [businessDate]: { type: 'workout', workoutPlan: 'A', syncedToNotion: true } } : {}),
        ...(review ? { '2026-09-01': { type: 'workout', workoutPlan: 'A', syncedToNotion: true } } : {}),
      }, weightRecords: [{ date, val: '70' }], lastWeights: {},
      currentSession: draft ? { bench: [{ weight: '40', reps: '8', completed: true }] } : {}, currentFeedback: {},
      ...(draft ? { draftDate: businessDate, workoutCache: cachedPlan, workoutStartedAt: Date.now(), currentExerciseId: 'bench' } : {}),
    }));
    localStorage.setItem('e2e-seeded', 'yes');
  }, { ...options, businessDate: plan.date, cachedPlan: plan });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: true } });
    if (url.pathname === '/api/workout/today') return route.fulfill({ json: options.recovery ? { ...plan, trainingDay: null, isRecoveryDay: true, exercises: [] } : plan });
    if (url.pathname === '/api/workout/complete') {
      calls.submissions.push(route.request().postDataJSON());
      const failures = options.failSave === true ? 1 : typeof options.failSave === 'number' ? options.failSave : 0;
      if (calls.submissions.length <= failures) return route.fulfill({ status: 503, json: { error: 'Notion 暂时不可用' } });
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname === '/api/ai/workout-review') {
      calls.reviews += 1;
      return route.fulfill(options.review ? { json: { content: '今天卧推很稳定，继续保持动作质量。' } } : { status: 503, json: { error: 'AI 暂时不可用' } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A 日', exact: true }).or(page.getByRole('heading', { name: 'Recovery', exact: true }))).toBeVisible();
  return calls;
}

test('Today is read-only; detail starts the selected exercise; draft survives reload', async ({ page }) => {
  const calls = await setup(page);
  await expect(page.locator('#today-workout input')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '完成打卡', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始训练', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '坐姿绳索划船 动作详情', exact: true }).click();
  await page.getByRole('button', { name: '开始训练', exact: true }).last().click();
  const mode = page.getByRole('dialog', { name: '训练模式', exact: true });
  await expect(mode.getByRole('heading', { name: '坐姿绳索划船' })).toBeVisible();
  await expect(mode.getByLabel('末组 RIR 0–10')).toHaveCount(0);
  await mode.getByRole('button', { name: '完成本组' }).click();
  await expect(mode.getByRole('timer')).toBeVisible();
  await expect(mode.getByLabel('重量 KG')).toBeFocused();
  await mode.getByRole('button', { name: '暂存并返回' }).click();
  await expect(page.getByRole('button', { name: '继续训练 · 1/4 组' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '继续训练 · 1/4 组' }).click();
  await expect(mode.getByRole('heading', { name: '坐姿绳索划船' })).toBeVisible();
  expect(calls.submissions).toHaveLength(0);
});

test('partial completion asks first, preserves draft on failure and retries with the same id', async ({ page }, testInfo) => {
  const calls = await setup(page, { failSave: true });
  await page.getByRole('button', { name: '开始训练', exact: true }).click();
  await page.getByRole('button', { name: '完成本组' }).click();
  await page.getByRole('button', { name: '结束训练', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('还有 3 组未完成');
  await page.screenshot({ path: testInfo.outputPath('finish-confirmation.png') });
  expect(calls.submissions).toHaveLength(0);
  await page.getByRole('button', { name: '继续训练', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: '结束训练', exact: true }).click();
  await page.getByRole('button', { name: '结束并保存当前完成内容' }).click();
  await expect(page.getByText(/Notion 暂时不可用；本地草稿已保留/)).toBeVisible();
  expect(calls.reviews).toBe(0);
  await page.getByRole('button', { name: '结束训练', exact: true }).click();
  await page.getByRole('button', { name: '结束并保存当前完成内容' }).click();
  await expect(page.getByRole('heading', { name: '训练已保存', exact: true })).toBeVisible();
  await expect(page.getByText('离线鼓励')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('summary.png') });
  expect(calls.submissions).toHaveLength(2);
  expect(calls.submissions[0].submissionId).toBe(calls.submissions[1].submissionId);
  expect(calls.submissions[1].exercises[0].sets[1]).toEqual({ weight: '', reps: '', completed: false });
  expect(calls.submissions[1].exercises[1].sets.every((set: any) => !set.completed && !set.weight && !set.reps)).toBe(true);
  await page.getByRole('button', { name: '返回今日', exact: true }).click();
  await expect(page.getByRole('button', { name: '今日已完成 ✓' })).toBeDisabled();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('FILLUP_2026_V26_STABLE') || '{}'));
  expect(saved.history[plan.date]?.syncedToNotion).toBe(true);
  expect(saved.history[new Date().toLocaleDateString('en-CA')]).toBeUndefined();
});

test('all sets complete shows feedback then saves directly, generating one review', async ({ page }) => {
  const calls = await setup(page, { review: true });
  await page.getByRole('button', { name: '开始训练', exact: true }).click();
  for (let exercise = 0; exercise < 2; exercise += 1) {
    await page.getByRole('button', { name: '完成本组' }).click();
    await page.getByRole('button', { name: '完成本组' }).click();
    await expect(page.getByLabel('末组 RIR 0–10')).toBeVisible();
    await page.getByLabel('末组 RIR 0–10').fill('2');
    if (exercise === 0) await page.getByRole('button', { name: '下一动作' }).click();
  }
  await page.getByRole('button', { name: '结束训练', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('paragraph').filter({ hasText: '今天卧推很稳定，继续保持动作质量。' })).toBeVisible();
  expect(calls.submissions).toHaveLength(1);
  expect(calls.reviews).toBe(1);
  await page.getByRole('button', { name: '返回今日', exact: true }).click();
  await expect(page.getByRole('button', { name: '今日已完成 ✓' })).toBeDisabled();
  expect(calls.reviews).toBe(1);
});

test('editing set data after a failed retry generates a new submission id', async ({ page }) => {
  const calls = await setup(page, { failSave: 2 });
  await page.getByRole('button', { name: '开始训练', exact: true }).click();
  await page.getByRole('button', { name: '完成本组' }).click();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole('button', { name: '结束训练', exact: true }).click();
    await page.getByRole('button', { name: '结束并保存当前完成内容' }).click();
    await expect(page.getByText(/Notion 暂时不可用；本地草稿已保留/)).toBeVisible();
  }
  expect(calls.submissions[0].submissionId).toBe(calls.submissions[1].submissionId);

  await page.getByLabel('重量 KG').fill('41');
  await page.getByRole('button', { name: '结束训练', exact: true }).click();
  await page.getByRole('button', { name: '结束并保存当前完成内容' }).click();
  await expect(page.getByRole('heading', { name: '训练已保存', exact: true })).toBeVisible();
  expect(calls.submissions[2].submissionId).not.toBe(calls.submissions[1].submissionId);
});

test('recovery is local and completed Today cannot restart', async ({ page }) => {
  const calls = await setup(page, { recovery: true });
  await page.getByRole('button', { name: '记录恢复日' }).click();
  await page.getByRole('button', { name: /跳过/ }).click();
  expect(calls.submissions).toHaveLength(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('FILLUP_2026_V26_STABLE') || '{}'));
  expect(saved.history[plan.date]?.type).toBe('rest');
});

test('390×844 Today and workout do not overflow horizontally', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('today.png'), fullPage: true });
  await page.getByRole('button', { name: '开始训练', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: '下一动作' })).toBeInViewport();
  await page.getByRole('button', { name: '完成本组' }).click();
  await page.screenshot({ path: testInfo.outputPath('workout.png') });
});

test('completed history disables the CTA and removes detail start', async ({ page }) => {
  const calls = await setup(page, { completed: true });
  await expect(page.getByRole('button', { name: '今日已完成 ✓' })).toBeDisabled();
  await page.getByRole('button', { name: '史密斯平板卧推 动作详情' }).click();
  await expect(page.getByRole('button', { name: '开始训练', exact: true })).toHaveCount(0);
  expect(calls.submissions).toHaveLength(0);
});

test('same-day review takes priority over the current draft', async ({ page }) => {
  await setup(page, { draft: true, review: true });
  await page.evaluate(async () => {
    const request = indexedDB.open('keep-fit-ai', 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = database.transaction(['conversations', 'messages'], 'readwrite');
    tx.objectStore('conversations').put({ id: 'prior-review', type: 'daily-workout', title: '今日训练 · 2026-09-01', createdAt: 1, updatedAt: 1 });
    tx.objectStore('messages').put({ id: 'prior-message', conversationId: 'prior-review', role: 'assistant', content: '上次卧推稳定，今天保持重量。', createdAt: 1 });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    database.close();
  });
  await page.reload();
  await expect(page.getByRole('region', { name: '教练提示' })).toContainText('上次卧推稳定，今天保持重量。');
  await expect(page.getByRole('button', { name: '继续训练 · 1/4 组' })).toBeVisible();
});
