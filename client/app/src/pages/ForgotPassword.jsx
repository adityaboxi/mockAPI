// src/pages/ForgotPassword.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../services/apiClient';
import { useToast } from '../context/ToastContext';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { showSuccess, showError, showWarning } = useToast();
  const isWhiteTheme = theme === 'white';

  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // ─── API handlers ────────────────────────────────────────────────────────
  const handleRequestOTP = useCallback(async (e) => {
    if (e) e.preventDefault();
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId) {
      showWarning('Please enter your username or registered email.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/api/forgot-password', { identifier: cleanId });
      showSuccess('OTP has been dispatched to your email address.');
      setStep(2);
    } catch (err) {
      showError(err.message || 'Failed to send OTP. Please verify your details.');
    } finally {
      setLoading(false);
    }
  }, [identifier, showSuccess, showError, showWarning]);

  const handleVerifyOTP = useCallback(async (e) => {
    if (e) e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      showWarning('Please enter a valid 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiClient.post('/api/verify-forgot-otp', {
        identifier: identifier.trim().toLowerCase(),
        otp: cleanOtp,
      });
      setResetToken(data.resetToken || '');
      showSuccess('Code verified! Please specify your new password.');
      setStep(3);
    } catch (err) {
      showError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  }, [identifier, otp, showSuccess, showError, showWarning]);

  const handleResetPassword = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!resetToken) {
      showWarning('Session expired. Please request a new verification code.');
      setStep(1);
      return;
    }
    if (newPassword.length < 6) {
      showWarning('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showWarning('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/api/reset-password', { resetToken, newPassword });
      showSuccess('Password updated successfully! Redirecting to login...');
      redirectTimerRef.current = setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      showError(err.message || 'Failed to reset password. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [resetToken, newPassword, confirmPassword, navigate, showSuccess, showError, showWarning]);

  const goBack = useCallback(() => {
    setStep(1);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResetToken('');
  }, []);

  // ─── Theme-aware design tokens ──────────────────────────────────────────
  const pageBg = isWhiteTheme ? 'bg-[#f8fafc]' : 'bg-[#09090b]';
  const cardBg = isWhiteTheme ? 'bg-white' : 'bg-zinc-900/90';
  const borderColor = isWhiteTheme ? 'border-slate-200' : 'border-zinc-800';
  const labelText = isWhiteTheme ? 'text-slate-600' : 'text-zinc-400';
  const inputBg = isWhiteTheme ? 'bg-slate-50' : 'bg-zinc-950/70';
  const inputBorder = isWhiteTheme ? 'border-slate-200' : 'border-zinc-800';
  const inputText = isWhiteTheme ? 'text-slate-800' : 'text-zinc-100';
  const inputBase = `w-full rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none transition-all border ${inputBg} ${inputBorder} focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${inputText}`;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 selection:bg-blue-500/30 transition-colors duration-200 ${pageBg}`}>
      <div className={`p-8 rounded-2xl border w-full max-w-sm transition-all duration-200 shadow-xl ${cardBg} ${borderColor}`}>
        {/* Header */}
        <div className="text-center mb-6 space-y-1">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mx-auto text-base font-bold mb-2 select-none">
            🔑
          </div>
          <h1 className={`text-base font-bold ${isWhiteTheme ? 'text-slate-800' : 'text-white'}`}>
            Account Recovery
          </h1>
          <p className={`text-xs ${labelText}`}>
            {step === 1 && 'Enter your username or registered email'}
            {step === 2 && 'Enter the 6-digit OTP code sent to your inbox'}
            {step === 3 && 'Create a secure new password'}
          </p>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-6 bg-blue-500'
                    : s < step
                    ? 'w-3 bg-emerald-500'
                    : 'w-3 bg-zinc-700/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Request OTP */}
        {step === 1 && (
          <form onSubmit={handleRequestOTP} className="space-y-4">
            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 uppercase tracking-wide ${labelText}`}>
                Username or Email
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="developer@mockapi.io"
                className={inputBase}
                disabled={loading}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 active:scale-95"
            >
              {loading ? 'Sending OTP...' : 'Send Verification OTP'}
            </button>
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs text-blue-500 hover:text-blue-400 hover:underline font-medium"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Verify OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 uppercase tracking-wide ${labelText}`}>
                6-Digit Security Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                className={`${inputBase} text-center font-mono tracking-widest text-sm`}
                disabled={loading}
                autoFocus
              />
              <p className={`text-[10px] mt-1 text-center ${labelText}`}>
                Valid for 10 minutes. Check your spam folder if delayed.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 active:scale-95"
            >
              {loading ? 'Verifying Code...' : 'Verify & Proceed'}
            </button>
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={goBack}
                className={`text-xs ${isWhiteTheme ? 'text-slate-500 hover:text-slate-700' : 'text-zinc-400 hover:text-zinc-200'} hover:underline font-medium`}
              >
                ← Request New Code
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Reset Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 uppercase tracking-wide ${labelText}`}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={inputBase}
                disabled={loading}
                autoFocus
              />
            </div>
            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 uppercase tracking-wide ${labelText}`}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className={inputBase}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 active:scale-95"
            >
              {loading ? 'Securing Account...' : 'Set New Password'}
            </button>
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={goBack}
                className={`text-xs ${isWhiteTheme ? 'text-slate-500 hover:text-slate-700' : 'text-zinc-400 hover:text-zinc-200'} hover:underline font-medium`}
              >
                ← Start Over
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default React.memo(ForgotPassword);