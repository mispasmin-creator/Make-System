import { useState } from 'react';
import { ArrowRight, LockKeyhole, UserRound, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/authService';

export function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await authService.login(username, password, true);
      onLoginSuccess?.(user);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100';

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#f2f5fc] px-4 py-6" style={{ fontFamily: 'var(--font-sans)' }}>
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[560px] -translate-x-1/2 -translate-y-1/2 blur-[80px]" style={{ background: 'radial-gradient(circle, rgba(115,169,251,0.30) 0%, rgba(219,233,253,0.45) 60%, transparent 80%)' }} />

      <main data-cursor-float className="login-floating-card relative z-10 w-full max-w-[380px] overflow-hidden rounded-3xl border border-white/90 bg-white shadow-[0_24px_60px_-18px_rgba(59,123,242,0.30)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#73a9fb] via-[#4f8df7] to-[#9cc4ff]" />
        <div className="px-8 pb-8 pt-7">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="animate-logo-float mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2.5 shadow-[0_10px_24px_-6px_rgba(59,123,242,0.30)] ring-1 ring-blue-50">
              <img src="/logo.png" alt="Make System Logo" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#2f4468]">Make <span className="text-[#3b7bf2]">System</span></h1>
            <p className="mt-1 text-xs text-slate-500">Sign in to continue</p>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
            <div className="relative">
              <UserRound aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
              <input id="loginUser" type="text" required autoFocus autoComplete="username" placeholder="Username" aria-label="Username" value={username} onChange={e => setUsername(e.target.value)} className={field} />
            </div>
            <div className="relative">
              <LockKeyhole aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
              <input id="loginPassword" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Password" aria-label="Password" value={password} onChange={e => setPassword(e.target.value)} className={`${field} pr-11`} />
              <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button type="submit" disabled={isLoading} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3b7bf2] py-3 text-sm font-bold text-white shadow-[0_6px_16px_rgba(59,123,242,0.30)] transition hover:-translate-y-px hover:bg-[#2f6ae0] disabled:translate-y-0 disabled:opacity-70">
              {isLoading ? (<><Loader2 className="h-[18px] w-[18px] animate-spin" /><span>Signing in...</span></>) : (<><span>Login</span><ArrowRight className="h-4 w-4" strokeWidth={2.2} /></>)}
            </button>
          </form>
          <p className="mt-5 text-center text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">Plan &bull; Build &bull; Track &bull; Grow</p>
        </div>
      </main>
    </div>
  );
}
