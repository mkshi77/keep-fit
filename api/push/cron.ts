import { getDuePushSubscriptions, sendPushNotification, getVapidConfig } from '../../server/pushStore.js';
import { dateInTimeZone, getTodayWorkoutFromNotion } from '../../server/workout.js';
import type { ApiRequest, ApiResponse } from '../../server/http.js';

const reminderMessage = (trainingDay: string, exercises: string[]) => {
  const list = exercises.slice(0, 3).join('、') + (exercises.length > 3 ? ' 等' : '');
  return `🏋️ 今晚 ${trainingDay} 日：${list}。先热身，动作质量优先 💪`;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.PUSH_CRON_SECRET;
  if (!cronSecret || request.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return response.status(403).json({ error: 'Cron secret 无效' });
  }

  const config = getVapidConfig();
  if (!config) return response.status(503).json({ error: 'VAPID keys 未配置' });

  try {
    const date = dateInTimeZone();
    const now = new Intl.DateTimeFormat('en-GB', {
      timeZone: process.env.APP_TIME_ZONE || 'Asia/Shanghai',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date());

    const due = getDuePushSubscriptions(now);
    if (due.length === 0) return response.status(200).json({ sent: 0, skipped: 'no due subscriptions' });

    const workout = await getTodayWorkoutFromNotion(date);
    if (workout.isRecoveryDay) return response.status(200).json({ sent: 0, skipped: 'recovery day' });

    const allCompleted = workout.exercises.every((e) => e.completed);
    if (allCompleted) return response.status(200).json({ sent: 0, skipped: 'workout completed' });

    const day = workout.trainingDay ?? '';
    const names = workout.exercises.map((e) => e.name);
    const payload = { title: 'Keep Fit 训练提醒', body: reminderMessage(day, names) };

    const results = await Promise.allSettled(
      due.map((record) => sendPushNotification(record.subscription, payload)),
    );
    const sent = results.filter((r) => r.status === 'fulfilled').length;
    return response.status(200).json({ sent, total: due.length });
  } catch (error) {
    console.error('Push cron failed', error instanceof Error ? error.message : error);
    return response.status(500).json({ error: '推送发送失败' });
  }
}
