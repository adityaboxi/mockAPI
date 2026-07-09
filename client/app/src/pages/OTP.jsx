import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function OTP() {
  const [otp, setOtp] = useState("");
  const { login } = useAuth();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();
  const username = location.state?.username;
  const email = location.state?.email;
  const password = location.state?.password;
  const name = location.state?.name;
  const { theme } = useTheme();
  const isWhiteTheme = theme === "white";

  const intervalRef = useRef(null);
  const hasSent = useRef(false);
  const OTP_TIMER = parseInt(import.meta.env.VITE_OTP_TIMER) || 120;

  // Use dedicated environment variables for OTP endpoints
  const OTP_RESEND_URL = import.meta.env.VITE_API_URL_OTPRESEND;
  const OTP_VERIFY_URL = import.meta.env.VITE_API_URL_OTPVERIFY;

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const startTimer = (seconds) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimer(seconds);
    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setError("OTP has expired. Please request a new one.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(OTP_RESEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, username }),
      });
      const data = await response.json();
      if (response.ok) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        startTimer(OTP_TIMER);
      } else {
        setError(data.message || "Failed to send OTP");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (email && username && !hasSent.current) {
      hasSent.current = true;
      sendOtp();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const verifyOtp = async () => {
    if (!otp) {
      setError("Please enter OTP");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(OTP_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, username, otp, password, name }),
      });
      const data = await response.json();
      if (response.ok) {
        await login(data.user);
        navigate("/");
      } else {
        setError(data.message || "Verification failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!username || !email) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans selection:bg-blue-500/30 p-4 ${
        isWhiteTheme ? "bg-gray-100" : "bg-[#1e1e24]"
      }`}>
        <div className={`p-8 rounded shadow-lg border w-full max-w-sm text-center ${
          isWhiteTheme ? "bg-white border-gray-200" : "bg-[#2b2d31] border-zinc-700/50"
        }`}>
          <h1 className="text-lg font-semibold text-red-400 mb-2">Unauthorized Access</h1>
          <p className={`text-sm mb-6 ${isWhiteTheme ? "text-gray-600" : "text-gray-400"}`}>
            Please sign up first to access this page.
          </p>
          <button onClick={() => navigate("/signup")} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded text-sm transition-colors">
            Go to Signup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center font-sans selection:bg-blue-500/30 p-4 ${
      isWhiteTheme ? "bg-gray-100" : "bg-[#1e1e24]"
    }`}>
      <div className={`p-8 rounded shadow-lg border w-full max-w-sm ${
        isWhiteTheme ? "bg-white border-gray-200" : "bg-[#2b2d31] border-zinc-700/50"
      }`}>
        <h1 className={`text-lg font-semibold mb-2 ${isWhiteTheme ? "text-gray-800" : "text-gray-200"}`}>OTP Verification</h1>
        <p className={`text-sm mb-5 ${isWhiteTheme ? "text-gray-600" : "text-gray-400"}`}>
          Verification code sent to: <strong className={isWhiteTheme ? "text-gray-800" : "text-gray-200"}>{email}</strong>
        </p>

        <div className={`p-3 rounded mb-4 text-center text-sm transition-colors duration-300 border ${
          timer < 10
            ? isWhiteTheme
              ? "bg-red-100 border-red-400 text-red-700"
              : "bg-red-900/30 border-red-500/50 text-red-400"
            : isWhiteTheme
              ? "bg-green-100 border-green-400 text-green-700"
              : "bg-green-900/30 border-green-500/50 text-green-400"
        }`}>
          <strong className="font-medium">OTP Valid For: {timer} seconds</strong>
          {timer === 0 && <span className="font-bold"> (Expired!)</span>}
        </div>

        <h3 className={`text-xs font-medium mb-2 ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>
          Resend available in: {timer} seconds
        </h3>

        <input
          type="text"
          placeholder="Enter 6-digit OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength="6"
          disabled={timer === 0 || isLoading}
          className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-5 tracking-widest ${
            isWhiteTheme
              ? "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500"
              : "bg-[#1e1f22] border border-zinc-700/50 text-gray-200 placeholder-zinc-600 focus:border-blue-500"
          }`}
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={verifyOtp}
            disabled={timer === 0 || isLoading}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              timer === 0 || isLoading
                ? isWhiteTheme
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-[#1e1f22] text-zinc-500 border border-zinc-700/50 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 text-white"
            }`}
          >
            {isLoading ? "Verifying..." : "Verify OTP"}
          </button>
          <button
            onClick={sendOtp}
            disabled={timer > 0 || isLoading}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              timer > 0 || isLoading
                ? isWhiteTheme
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-[#1e1f22] text-zinc-500 border border-zinc-700/50 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {isLoading ? "Sending..." : timer > 0 ? `Resend OTP (${timer}s)` : "Resend OTP"}
          </button>
        </div>

        {error && <p className="text-red-400 mt-4 text-center text-xs">{error}</p>}
      </div>
    </div>
  );
}

export default OTP;