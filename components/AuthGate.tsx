import React, { useState } from 'react';
import { signIn } from '../services/authApi';

interface AuthGateProps {
  onAuthenticated: () => void;
}

const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim() || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      await signIn(password.trim());
      onAuthenticated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-[380px] bg-card border border-[#222] rounded-2xl p-6">
        <h1 className="text-xl font-black italic">Keep Fit</h1>
        <p className="mt-2 text-sm text-gray-400">请输入访问密码以同步训练数据。</p>
        <label className="block mt-6 text-xs text-gray-500 font-bold" htmlFor="access-password">访问密码</label>
        <input
          id="access-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full h-12 rounded-xl bg-[#111] border border-[#2a2a2a] px-4 text-white outline-none focus:border-accent"
          required
        />
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isLoading || !password.trim()}
          className="mt-6 w-full h-12 rounded-xl bg-accent text-black font-black disabled:opacity-50"
        >
          {isLoading ? '验证中...' : '进入训练'}
        </button>
      </form>
    </main>
  );
};

export default AuthGate;
