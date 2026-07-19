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

  // ─── Environment ──────────────────────────────────────────────
  const OTP_TIMER = parseInt(import.meta.env.VITE_OTP_TIMER) || 120;
  const RESEND_URL = import.meta.env.VITE_API_URL_OTPRESEND;
  const VERIFY_URL = import.meta.env.VITE_API_URL_OTPVERIFY;

  // ─── State ──────────────────────────────────────────────────
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(OTP_TIMER);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState(null);

  const intervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  // ─── Timer helpers ──────────────────────────────────────────
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
      setError(null); // clear expiry error when timer restarts

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

  // ─── API calls (with AbortController) ──────────────────────
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
        setOtp(""); // clear old OTP
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
        // Brief delay for a smooth transition
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

  // ─── Input handler (digits only, max 6) ────────────────────
  const handleOtpChange = useCallback((e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);
    setError(null); // clear error on typing
  }, []);

  // ─── Auto‑submit when 6 digits are entered ──────────────────
  useEffect(() => {
    if (otp.length === 6 && timer > 0 && !isVerifying && !isResending) {
      verifyOtp();
    }
  }, [otp, timer, isVerifying, isResending, verifyOtp]);

  // ─── Mount: start the timer ─────────────────────────────────
  useEffect(() => {
    if (email && username) {
      startTimer(OTP_TIMER);
    }
    return () => {
      clearTimer();
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only run once

  // ─── Theme classes ──────────────────────────────────────────
  const themeClasses = {
    page: isWhiteTheme ? "bg-gray-100" : "bg-zinc-950",
    card: isWhiteTheme
      ? "bg-white border-gray-200"
      : "bg-zinc-900 border-zinc-800",
    text: isWhiteTheme ? "text-gray-800" : "text-white",
    muted: isWhiteTheme ? "text-gray-600" : "text-zinc-400",
    input: isWhiteTheme
      ? "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400"
      : "bg-zinc-900 border-zinc-800 text-zinc-300 placeholder-zinc-500",
    inputFocus: "focus:border-blue-500",
    timerBox: (timer < 10)
      ? (isWhiteTheme
        ? "bg-red-100 border-red-400 text-red-700"
        : "bg-red-500/10 border-red-500/30 text-red-400")
      : (isWhiteTheme
        ? "bg-green-100 border-green-400 text-green-700"
        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"),
    buttonPrimary: "bg-blue-600 hover:bg-blue-500 text-white",
    buttonDisabled: isWhiteTheme
      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
      : "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed",
  };

  // ─── Guard: missing user data ──────────────────────────────
  if (!username || !email) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${themeClasses.page}`}>
        <div className={`p-8 rounded shadow-lg border w-full max-w-sm text-center ${themeClasses.card}`}>
          <h1 className="text-lg font-semibold text-red-400 mb-2">Unauthorized Access</h1>
          <p className={`text-sm mb-6 ${themeClasses.muted}`}>
            Please sign up first to access this page.
          </p>
          <button
            onClick={() => navigate("/signup")}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded text-sm transition-colors"
          >
            Go to Signup
          </button>
        </div>
      </div>
    );
  }

  const isExpired = timer === 0;
  const isActionDisabled = isExpired || isVerifying || isResending;
  const inputBase = `w-full rounded px-3 py-2 text-sm outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed tracking-widest ${themeClasses.input} ${themeClasses.inputFocus}`;

  // ─── Main render ────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${themeClasses.page}`}>
      <div className={`p-8 rounded shadow-lg border w-full max-w-sm ${themeClasses.card}`}>
        <h1 className={`text-lg font-semibold mb-2 ${themeClasses.text}`}>OTP Verification</h1>
        <p className={`text-sm mb-5 ${themeClasses.muted}`}>
          Verification code sent to: <strong className={themeClasses.text}>{email}</strong>
        </p>

        {/* Timer display */}
        <div className={`p-3 rounded mb-4 text-center text-sm transition-colors duration-300 border ${themeClasses.timerBox}`}>
          {isExpired ? (
            <span className="font-bold">⏳ OTP Expired – request a new one</span>
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
          className={inputBase}
          autoFocus
        />

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <button
            onClick={verifyOtp}
            disabled={isActionDisabled || otp.length < 6}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              isActionDisabled || otp.length < 6
                ? themeClasses.buttonDisabled
                : themeClasses.buttonPrimary
            }`}
          >
            {isVerifying ? "Verifying…" : "Verify OTP"}
          </button>
          <button
            onClick={sendOtp}
            disabled={!isExpired || isResending}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              !isExpired || isResending
                ? themeClasses.buttonDisabled
                : themeClasses.buttonPrimary
            }`}
          >
            {isResending ? "Sending…" : isExpired ? "Resend OTP" : `Resend OTP (${timer}s)`}
          </button>
        </div>

        {error && <p className="text-red-400 mt-4 text-center text-xs">{error}</p>}
      </div>
    </div>
  );
}

export default OTP;