import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

function Signup() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isWhiteTheme = theme === "white";

  // ─── Form state ──────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ─── Validation states ──────────────────────────────────────
  const [emailStatus, setEmailStatus] = useState(null); // true = available, false = taken
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [isEmailChecking, setIsEmailChecking] = useState(false);
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ─── Refs for debouncing & abort ────────────────────────────
  const emailTimeoutRef = useRef(null);
  const usernameTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // ─── Environment ──────────────────────────────────────────────
  const VALID_EMAIL_URL = import.meta.env.VITE_API_URL_VALIDEMAIL;
  const VALID_USERNAME_URL = import.meta.env.VITE_API_URL_VALIDUSERNAME;
  const SIGNUP_URL = import.meta.env.VITE_API_URL_SIGNUP;

  // ─── Cleanup on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      emailTimeoutRef.current && clearTimeout(emailTimeoutRef.current);
      usernameTimeoutRef.current && clearTimeout(usernameTimeoutRef.current);
      abortControllerRef.current && abortControllerRef.current.abort();
    };
  }, []);

  // ─── Validation helpers (with AbortController) ──────────────
  const validateField = useCallback(async (url, body, setStatus, setIsChecking) => {
    // Cancel previous request
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
      // 200 = available, 409 = taken, other = treat as unavailable
      setStatus(response.status === 200);
    } catch (err) {
      if (err.name === "AbortError") return;
      setStatus(false); // treat network errors as invalid
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

  // ─── Handlers ────────────────────────────────────────────────
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

    // 1. Basic validation
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
      // Wait for validation to complete (or force a check)
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

  // ─── Theme classes ──────────────────────────────────────────
  const themeClasses = {
    page: isWhiteTheme ? "bg-gray-100" : "bg-zinc-950",
    card: isWhiteTheme
      ? "bg-white border-gray-200"
      : "bg-zinc-900 border-zinc-800",
    label: isWhiteTheme ? "text-gray-500" : "text-zinc-400",
    input: isWhiteTheme
      ? "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400"
      : "bg-zinc-900 border-zinc-800 text-zinc-300 placeholder-zinc-500",
    inputFocus: "focus:border-blue-500",
    button: "bg-blue-600 hover:bg-blue-500 text-white",
    buttonDisabled: "opacity-50 cursor-not-allowed",
  };

  const inputBase = `w-full rounded px-3 py-2 text-sm outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${themeClasses.input} ${themeClasses.inputFocus}`;
  const labelBase = `text-xs font-medium mb-1 ${themeClasses.label}`;

  // ─── Helper to render validation status ─────────────────────
  const renderValidation = (status, checking, validMsg, invalidMsg) => {
    if (checking) return <span className="text-xs text-blue-400">checking…</span>;
    if (status === true) return <span className="text-xs text-green-400">✓ {validMsg}</span>;
    if (status === false) return <span className="text-xs text-red-400">✗ {invalidMsg}</span>;
    return null;
  };

  // ─── Main render ─────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex items-center justify-center py-8 px-4 ${themeClasses.page} font-sans`}>
      <div className={`p-8 rounded shadow-lg border w-full max-w-sm ${themeClasses.card}`}>
        <h2 className={`text-xl font-semibold mb-6 ${isWhiteTheme ? "text-gray-800" : "text-white"}`}>
          Create Account
        </h2>

        {/* Name */}
        <div className="mb-4">
          <label className={labelBase}>Full Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={handleNameChange}
            disabled={isLoading}
            className={inputBase}
            placeholder="John Doe"
          />
        </div>

        {/* Email */}
        <div className="mb-4">
          <label className={labelBase}>Email</label>
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            onBlur={() => checkEmail(email)}
            disabled={isLoading}
            className={inputBase}
            placeholder="you@example.com"
          />
          {renderValidation(emailStatus, isEmailChecking, "email available", "email already taken")}
        </div>

        {/* Username */}
        <div className="mb-4">
          <label className={labelBase}>Username</label>
          <input
            type="text"
            value={username}
            onChange={handleUsernameChange}
            onBlur={() => checkUsername(username)}
            disabled={isLoading}
            className={inputBase}
            placeholder="cooluser123"
          />
          {renderValidation(usernameStatus, isUsernameChecking, "username available", "username already taken")}
        </div>

        {/* Password */}
        <div className="mb-4">
          <label className={labelBase}>Password</label>
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            disabled={isLoading}
            className={inputBase}
            placeholder="••••••••"
          />
        </div>

        {/* Confirm Password */}
        <div className="mb-4">
          <label className={labelBase}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={handleConfirmChange}
            disabled={isLoading}
            className={inputBase}
            placeholder="••••••••"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-red-400 mt-1">✗ passwords do not match</p>
          )}
          {confirmPassword && password === confirmPassword && password.length > 0 && (
            <p className="text-xs text-green-400 mt-1">✓ passwords match</p>
          )}
        </div>

        {/* Global error */}
        {signupError && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-center text-xs text-red-400">
            {signupError}
          </div>
        )}

        {/* Submit */}
        <div className="mt-6">
          <button
            onClick={handleSignup}
            disabled={isLoading}
            className={`w-full font-medium py-2 rounded text-sm transition-colors flex items-center justify-center gap-2 ${
              isLoading
                ? `${themeClasses.button} ${themeClasses.buttonDisabled}`
                : themeClasses.button
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
      </div>
    </div>
  );
}

export default Signup;