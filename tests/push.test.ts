import { describe, expect, it } from 'vitest';
import { getDuePushSubscriptions, savePushSubscription, removePushSubscription } from '../server/pushStore';

const makeSubscription = (endpoint: string) => ({
  endpoint,
  keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' },
});

describe('push subscription store', () => {
  it('saves and finds due subscriptions by remindTime', () => {
    savePushSubscription('https://push.example/sub-1', makeSubscription('https://push.example/sub-1'), '20:30');
    savePushSubscription('https://push.example/sub-2', makeSubscription('https://push.example/sub-2'), '21:00');

    const due = getDuePushSubscriptions('20:30');
    expect(due).toHaveLength(1);
    expect(due[0].subscription.endpoint).toBe('https://push.example/sub-1');
  });

  it('removes subscriptions', () => {
    savePushSubscription('https://push.example/sub-3', makeSubscription('https://push.example/sub-3'), '20:30');
    removePushSubscription('https://push.example/sub-3');
    expect(getDuePushSubscriptions('20:30').find((r) => r.subscription.endpoint === 'https://push.example/sub-3')).toBeUndefined();
  });

  it('returns empty when no due subscriptions', () => {
    expect(getDuePushSubscriptions('23:59')).toHaveLength(0);
  });
});
