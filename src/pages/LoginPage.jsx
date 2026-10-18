import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  FileText,
  Edit3,
  CheckCircle2,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { authService } from '../services/authService';

export function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await authService.login(username, password, rememberMe);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center py-5 px-4 bg-[#f4f7fc] relative overflow-x-hidden font-sans">
      
      {/* Background Decorative Soft Curved Waves */}
      <div className="absolute top-0 right-0 w-[480px] h-[480px] bg-gradient-to-bl from-blue-100/50 via-sky-50/30 to-transparent rounded-full blur-3xl pointer-events-none -mr-28 -mt-28" />
      <div className="absolute bottom-0 left-0 w-[420px] h-[420px] bg-gradient-to-tr from-indigo-50/40 via-blue-50/25 to-transparent rounded-full blur-3xl pointer-events-none -ml-28 -mb-28" />

      {/* Top Header Bar with Pasary Logo + Make System Brand */}
      <header className="w-full max-w-[940px] flex items-center justify-between mb-3.5 relative z-10 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white shadow-xs border border-slate-200/80 p-1 flex items-center justify-center transition-transform hover:scale-105">
            <img
              src="/logo.png"
              alt="Pasary Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 leading-none">
                Make System
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                Pasary Enterprise
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Software Workflow & Lifecycle Automation
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full border border-slate-200/60 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Live & Ready</span>
        </div>
      </header>

      {/* Main Unified Split Card (Compact & Proportional Size) */}
      <main className="w-full max-w-[940px] bg-white rounded-2xl shadow-[0_16px_45px_-12px_rgba(15,23,42,0.08)] border border-slate-200/70 overflow-hidden relative z-10 flex flex-col lg:flex-row transition-all">
        
        {/* Left Column: Clean White Login Form */}
        <div className="lg:w-[46%] p-6 sm:p-8 flex flex-col justify-between bg-white border-b lg:border-b-0 lg:border-r border-slate-100">
          <div>
            {/* Header Title */}
            <div className="mb-5">
              <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 tracking-tight leading-tight">
                Welcome back
              </h1>
              <p className="text-slate-500 text-xs font-medium mt-1">
                Sign in to manage your system requests
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200/80 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-3.5">
              
              {/* User Field */}
              <div>
                <label
                  htmlFor="loginUser"
                  className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  User
                </label>
                <div className="relative">
                  <input
                    id="loginUser"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="Enter username (e.g. admin or ahitesh)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-600 transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="loginPassword"
                  className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="loginPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-3 focus:ring-blue-100 focus:border-blue-600 transition-all shadow-2xs tracking-widest font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Remember me (Forgot password removed as requested) */}
              <div className="flex items-center text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-[11px]">Remember me</span>
                </label>
              </div>

              {/* Sign In Primary Blue Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign in</span>
                )}
              </button>
            </form>

            {/* Administrator Contact Link */}
            <div className="mt-4 text-center text-[11px] text-slate-500">
              Need access?{' '}
              <a
                href="mailto:admin@pasary.com"
                className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
              >
                Contact your administrator.
              </a>
            </div>
          </div>


        </div>

        {/* Right Column: Hero Illustration & Compact SaaS Floating Cards */}
        <div className="lg:w-[54%] bg-gradient-to-br from-[#f8fafd] via-[#edf3fc] to-[#e4eefb] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          
          {/* Subtle Ambient Background circles */}
          <div className="absolute top-6 right-6 w-56 h-56 bg-blue-200/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-56 h-56 bg-sky-200/30 rounded-full blur-2xl pointer-events-none" />

          {/* Heading Section */}
          <div className="text-center relative z-10 mb-4">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Build better. Improve faster.
            </h2>
            <p className="text-slate-600 text-xs font-medium mt-1">
              Turn business requirements into digital solutions.
            </p>
          </div>

          {/* SaaS Floating Feature Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 relative z-10 mb-4">
            
            {/* Card 1: New request */}
            <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-xl p-2.5 shadow-[0_4px_12px_-4px_rgba(37,99,235,0.06)] flex items-start gap-2 hover:-translate-y-0.5 transition-all group">
              <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-bold text-slate-900 leading-tight truncate">
                  New request
                </span>
                <span className="text-[9px] text-slate-500 leading-tight block mt-0.5 truncate">
                  Submit new system
                </span>
              </div>
            </div>

            {/* Card 2: Change request */}
            <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-xl p-2.5 shadow-[0_4px_12px_-4px_rgba(37,99,235,0.06)] flex items-start gap-2 hover:-translate-y-0.5 transition-all group">
              <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Edit3 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-bold text-slate-900 leading-tight truncate">
                  Change request
                </span>
                <span className="text-[9px] text-slate-500 leading-tight block mt-0.5 truncate">
                  Modify existing
                </span>
              </div>
            </div>

            {/* Card 3: Review */}
            <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-xl p-2.5 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.06)] flex items-start gap-2 hover:-translate-y-0.5 transition-all group">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-bold text-slate-900 leading-tight truncate">
                  Review & QA
                </span>
                <span className="text-[9px] text-slate-500 leading-tight block mt-0.5 truncate">
                  Track approvals
                </span>
              </div>
            </div>
          </div>

          {/* Main Visual Illustration Mockup */}
          <div className="relative z-10 flex-1 flex items-center justify-center my-1">
            <div className="w-full max-w-sm rounded-xl bg-white/70 backdrop-blur-sm border border-white p-1.5 shadow-[0_12px_28px_-8px_rgba(37,99,235,0.1)] overflow-hidden transition-transform hover:scale-[1.01]">
              <img
                src="/login-hero.jpg"
                alt="Make System Lifecycle Collaboration"
                className="w-full h-auto max-h-[220px] object-contain rounded-lg"
              />
            </div>
          </div>

          {/* Micro Security Banner */}
          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-center gap-1.5 text-slate-500 text-[10px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pasary Minerals Enterprise Security • End-to-end Encrypted Sessions</span>
          </div>

        </div>
      </main>

      {/* Bottom Footer Note */}
      <footer className="w-full max-w-[940px] text-center mt-3 text-slate-400 text-[11px] font-medium relative z-10">
        Internal workspace • Authorized team members only
      </footer>

    </div>
  );
}
