// src/pages/OTP.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function OTP() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const isWhiteTheme = theme === "white";

  const location = useLocation();
  const navigate = useNavigate();
  const { username, email, password, name } = location.state || {};

  const OTP_TIMER = parseInt(import.meta.env.VITE_OTP_TIMER) || 120;
  const RESEND_URL = import.meta.env.VITE_API_URL_OTPRESEND;
  const VERIFY_URL = import.meta.env.VITE_API_URL_OTPVERIFY;

  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(OTP_TIMER);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState(null);

  const intervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (seconds) => {
      clearTimer();
      setTimer(seconds);
      setError(null);

      intervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearTimer();
            setError("OTP has expired. Please request a new one.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearTimer]
  );

  const sendOtp = useCallback(async () => {
    if (isResending || !email || !username) return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsResending(true);
    setError(null);

    try {
      const response = await fetch(RESEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, username }),
        signal: controller.signal,
      });
      const data = await response.json();

      if (response.ok) {
        startTimer(OTP_TIMER);
        setOtp("");
      } else {
        setError(data.message || "Failed to resend OTP.");
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setError("Network error. Please try again.");
    } finally {
      setIsResending(false);
      abortControllerRef.current = null;
    }
  }, [email, username, RESEND_URL, OTP_TIMER, startTimer, isResending]);

  const verifyOtp = useCallback(async () => {
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError("Please enter the full 6‑digit OTP.");
      return;
    }
    if (timer === 0) {
      setError("OTP has expired. Request a new one.");
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, username, otp: cleanOtp, password, name }),
        signal: controller.signal,
      });
      const data = await response.json();

      if (response.ok && data.user) {
        await login(data.user);
        setTimeout(() => {
          navigate("/general-questions", {
            state: { username, email, name },
            replace: true,
          });
        }, 300);
      } else {
        setError(data.message || "Verification failed. Please try again.");
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setError("Network error. Please try again.");
    } finally {
      setIsVerifying(false);
      abortControllerRef.current = null;
    }
  }, [otp, timer, email, username, password, name, VERIFY_URL, login, navigate]);

  const handleOtpChange = useCallback((e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);
    setError(null);
  }, []);

  useEffect(() => {
    if (otp.length === 6 && timer > 0 && !isVerifying && !isResending) {
      verifyOtp();
    }
  }, [otp, timer, isVerifying, isResending, verifyOtp]);

  useEffect(() => {
    if (email && username) {
      startTimer(OTP_TIMER);
    }
    return () => {
      clearTimer();
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Theme‑aware styles ──────────────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-gray-50" : "bg-zinc-950";
  const cardBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const shadow = isWhiteTheme ? "shadow-lg" : "shadow-xl shadow-black/20";
  const textPrimary = isWhiteTheme ? "text-gray-800" : "text-white";
  const textMuted = isWhiteTheme ? "text-gray-500" : "text-zinc-400";
  const inputBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const inputBorder = isWhiteTheme ? "border-gray-300" : "border-zinc-700";
  const inputFocus = "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none";
  const inputText = isWhiteTheme ? "text-gray-800" : "text-zinc-200";
  const inputPlaceholder = isWhiteTheme ? "placeholder-gray-400" : "placeholder-zinc-500";
  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200 border tracking-widest ${inputBg} ${inputBorder} ${inputFocus} ${inputText} ${inputPlaceholder}`;
  const timerBox = isWhiteTheme
    ? timer < 10 ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
    : timer < 10 ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
  const buttonPrimary = "bg-blue-600 hover:bg-blue-500 text-white";
  const buttonDisabled = isWhiteTheme
    ? "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300"
    : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700";

  // ─── Guard ──────────────────────────────────────────────────────
  if (!username || !email) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${pageBg}`}>
        <div className={`p-8 rounded-2xl border shadow-lg w-full max-w-sm text-center ${cardBg} ${borderColor}`}>
          <h1 className="text-lg font-semibold text-red-400 mb-2">Unauthorized Access</h1>
          <p className={`text-sm mb-6 ${textMuted}`}>
            Please sign up first to access this page.
          </p>
          <button
            onClick={() => navigate("/signup")}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${buttonPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-900'}`}
          >
            Go to Signup
          </button>
        </div>
      </div>
    );
  }

  const isExpired = timer === 0;
  const isActionDisabled = isExpired || isVerifying || isResending;

  // ─── Main render ──────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${pageBg}`}>
      <div className={`p-8 rounded-2xl border w-full max-w-sm transition-colors duration-200 ${cardBg} ${borderColor} ${shadow}`}>
        <div className="text-center mb-6">
          <div className="text-3xl mb-1">🔐</div>
          <h1 className={`text-lg font-semibold ${textPrimary}`}>OTP Verification</h1>
          <p className={`text-sm ${textMuted} mt-1`}>
            Verification code sent to <strong className={textPrimary}>{email}</strong>
          </p>
        </div>

        {/* Timer display */}
        <div className={`p-3 rounded-xl mb-5 text-center text-sm border transition-colors duration-300 ${timerBox}`}>
          {isExpired ? (
            <span className="font-medium">⏳ OTP Expired – request a new one</span>
          ) : (
            <span>
              <strong className="font-medium">OTP expires in:</strong> {timer} seconds
            </span>
          )}
        </div>

        {/* OTP input */}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter 6‑digit OTP"
          value={otp}
          onChange={handleOtpChange}
          maxLength="6"
          disabled={isActionDisabled}
          className={inputClass}
          autoFocus
        />

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <button
            onClick={verifyOtp}
            disabled={isActionDisabled || otp.length < 6}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-900'} ${
              isActionDisabled || otp.length < 6 ? buttonDisabled : buttonPrimary
            }`}
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying
              </span>
            ) : (
              "Verify OTP"
            )}
          </button>
          <button
            onClick={sendOtp}
            disabled={!isExpired || isResending}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-900'} ${
              !isExpired || isResending ? buttonDisabled : buttonPrimary
            }`}
          >
            {isResending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending
              </span>
            ) : isExpired ? (
              "Resend OTP"
            ) : (
              `Resend (${timer}s)`
            )}
          </button>
        </div>

        {error && (
          <div className={`mt-4 p-3 rounded-xl text-xs border ${isWhiteTheme ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default OTP;