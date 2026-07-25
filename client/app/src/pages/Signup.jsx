// src/pages/Signup.jsx
import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

function Signup() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isWhiteTheme = theme === "white";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [emailStatus, setEmailStatus] = useState(null);
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [isEmailChecking, setIsEmailChecking] = useState(false);
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const emailTimeoutRef = useRef(null);
  const usernameTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  const VALID_EMAIL_URL = import.meta.env.VITE_API_URL_VALIDEMAIL;
  const VALID_USERNAME_URL = import.meta.env.VITE_API_URL_VALIDUSERNAME;
  const SIGNUP_URL = import.meta.env.VITE_API_URL_SIGNUP;

  useEffect(() => {
    return () => {
      emailTimeoutRef.current && clearTimeout(emailTimeoutRef.current);
      usernameTimeoutRef.current && clearTimeout(usernameTimeoutRef.current);
      abortControllerRef.current && abortControllerRef.current.abort();
    };
  }, []);

  const validateField = useCallback(async (url, body, setStatus, setIsChecking) => {
    abortControllerRef.current && abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsChecking(true);
    setStatus(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      setStatus(response.status === 200);
    } catch (err) {
      if (err.name === "AbortError") return;
      setStatus(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const checkEmail = useCallback(
    (value) => {
      if (!value || !value.includes("@")) {
        setEmailStatus(null);
        return;
      }
      emailTimeoutRef.current && clearTimeout(emailTimeoutRef.current);
      emailTimeoutRef.current = setTimeout(() => {
        validateField(VALID_EMAIL_URL, { email: value }, setEmailStatus, setIsEmailChecking);
      }, 300);
    },
    [VALID_EMAIL_URL, validateField]
  );

  const checkUsername = useCallback(
    (value) => {
      if (!value || value.length < 3) {
        setUsernameStatus(null);
        return;
      }
      usernameTimeoutRef.current && clearTimeout(usernameTimeoutRef.current);
      usernameTimeoutRef.current = setTimeout(() => {
        validateField(VALID_USERNAME_URL, { username: value }, setUsernameStatus, setIsUsernameChecking);
      }, 300);
    },
    [VALID_USERNAME_URL, validateField]
  );

  const handleNameChange = useCallback((e) => setName(e.target.value), []);
  const handleEmailChange = useCallback((e) => {
    const val = e.target.value;
    setEmail(val);
    setEmailStatus(null);
    checkEmail(val);
  }, [checkEmail]);
  const handleUsernameChange = useCallback((e) => {
    const val = e.target.value;
    setUsername(val);
    setUsernameStatus(null);
    checkUsername(val);
  }, [checkUsername]);
  const handlePasswordChange = useCallback((e) => setPassword(e.target.value), []);
  const handleConfirmChange = useCallback((e) => setConfirmPassword(e.target.value), []);

  const handleSignup = useCallback(async () => {
    setSignupError("");

    if (!name || !email || !username || !password) {
      setSignupError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }
    if (emailStatus === false) {
      setSignupError("Email is already taken.");
      return;
    }
    if (usernameStatus === false) {
      setSignupError("Username is already taken.");
      return;
    }
    if (emailStatus === null || usernameStatus === null) {
      setSignupError("Please wait for email/username validation.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(SIGNUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, username, password }),
      });

      if (response.ok) {
        navigate("/otp", { state: { username, email, password, name } });
        return;
      }

      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || "Signup failed. Please try again.";
      setSignupError(errorMessage);
    } catch {
      setSignupError("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, [name, email, username, password, confirmPassword, emailStatus, usernameStatus, navigate, SIGNUP_URL]);

  // ─── Theme‑aware styles ──────────────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-gray-50" : "bg-zinc-950";
  const cardBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const shadow = isWhiteTheme ? "shadow-lg" : "shadow-xl shadow-black/20";
  const textPrimary = isWhiteTheme ? "text-gray-800" : "text-white";
  const labelText = isWhiteTheme ? "text-gray-600" : "text-zinc-400";
  const inputBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const inputBorder = isWhiteTheme ? "border-gray-300" : "border-zinc-700";
  const inputFocus = "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none";
  const inputText = isWhiteTheme ? "text-gray-800" : "text-zinc-200";
  const inputPlaceholder = isWhiteTheme ? "placeholder-gray-400" : "placeholder-zinc-500";
  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200 border ${inputBg} ${inputBorder} ${inputFocus} ${inputText} ${inputPlaceholder}`;
  const buttonPrimary = "bg-blue-600 hover:bg-blue-500 text-white";
  const buttonDisabled = isWhiteTheme
    ? "opacity-50 cursor-not-allowed"
    : "opacity-50 cursor-not-allowed";

  const renderValidation = (status, checking, validMsg, invalidMsg) => {
    if (checking) return <span className="text-xs text-blue-400">checking…</span>;
    if (status === true) return <span className="text-xs text-emerald-400">✓ {validMsg}</span>;
    if (status === false) return <span className="text-xs text-red-400">✗ {invalidMsg}</span>;
    return null;
  };

  return (
    <div className={`min-h-screen flex items-center justify-center py-8 px-4 transition-colors duration-200 ${pageBg}`}>
      <div className={`p-8 rounded-2xl border w-full max-w-sm transition-colors duration-200 ${cardBg} ${borderColor} ${shadow}`}>
        <div className="text-center mb-6">
          <div className="text-3xl mb-1">🚀</div>
          <h2 className={`text-lg font-semibold ${textPrimary}`}>Create Account</h2>
          <p className={`text-xs ${labelText} mt-1`}>Join MockAPI and start building</p>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className={`block text-xs font-medium mb-1.5 ${labelText}`}>Full Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={handleNameChange}
            disabled={isLoading}
            className={inputClass}
            placeholder="John Doe"
          />
        </div>

        {/* Email */}
        <div className="mb-4">
          <label className={`block text-xs font-medium mb-1.5 ${labelText}`}>Email</label>
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            onBlur={() => checkEmail(email)}
            disabled={isLoading}
            className={inputClass}
            placeholder="you@example.com"
          />
          <div className="mt-1">{renderValidation(emailStatus, isEmailChecking, "email available", "email already taken")}</div>
        </div>

        {/* Username */}
        <div className="mb-4">
          <label className={`block text-xs font-medium mb-1.5 ${labelText}`}>Username</label>
          <input
            type="text"
            value={username}
            onChange={handleUsernameChange}
            onBlur={() => checkUsername(username)}
            disabled={isLoading}
            className={inputClass}
            placeholder="cooluser123"
          />
          <div className="mt-1">{renderValidation(usernameStatus, isUsernameChecking, "username available", "username already taken")}</div>
        </div>

        {/* Password */}
        <div className="mb-4">
          <label className={`block text-xs font-medium mb-1.5 ${labelText}`}>Password</label>
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            disabled={isLoading}
            className={inputClass}
            placeholder="••••••••"
          />
        </div>

        {/* Confirm Password */}
        <div className="mb-4">
          <label className={`block text-xs font-medium mb-1.5 ${labelText}`}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={handleConfirmChange}
            disabled={isLoading}
            className={inputClass}
            placeholder="••••••••"
          />
          <div className="mt-1">
            {confirmPassword && password !== confirmPassword && (
              <span className="text-xs text-red-400">✗ passwords do not match</span>
            )}
            {confirmPassword && password === confirmPassword && password.length > 0 && (
              <span className="text-xs text-emerald-400">✓ passwords match</span>
            )}
          </div>
        </div>

        {/* Global error */}
        {signupError && (
          <div className={`mt-2 p-3 rounded-xl text-xs border ${
            isWhiteTheme
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            {signupError}
          </div>
        )}

        {/* Submit */}
        <div className="mt-6">
          <button
            onClick={handleSignup}
            disabled={isLoading}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"
            } ${
              isLoading
                ? `${buttonPrimary} ${buttonDisabled}`
                : buttonPrimary
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing up…
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </div>

        {/* Login link */}
        <div className="mt-4 text-center">
          <span className={`text-xs ${labelText}`}>Already have an account? </span>
          <button
            onClick={() => navigate("/login")}
            className="text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}

export default Signup;