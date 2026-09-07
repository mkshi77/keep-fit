export const checkSession = async () => {
  const response = await fetch('/api/auth/session', { method: 'GET', cache: 'no-store' });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || '未登录');
  }
};

export const signIn = async (password: string) => {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || '登录失败');
  }
};
