import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authenticateUser } from "../auth/authenticateUser";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isWhiteTheme = theme === "white";

  const handleSignup = () => navigate("/signup");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Please enter both username and password");
      return;
    }
    setIsLoading(true);
    try {
      const isAuthenticated = await authenticateUser(username, password);
      if (isAuthenticated) {
        await login({ username });
        navigate("/");
      } else {
        alert("Invalid credentials");
      }
    } catch (error) {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Theme-aware styles ──────────────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-gray-50" : "bg-zinc-950";
  const cardBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const shadow = isWhiteTheme ? "shadow-lg" : "shadow-xl shadow-black/20";
  const labelText = isWhiteTheme ? "text-gray-600" : "text-zinc-400";
  const inputBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const inputBorder = isWhiteTheme ? "border-gray-300" : "border-zinc-700";
  const inputFocus = "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none";
  const inputText = isWhiteTheme ? "text-gray-800" : "text-zinc-200";
  const inputPlaceholder = isWhiteTheme ? "placeholder-gray-400" : "placeholder-zinc-500";
  const inputBase = `w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all duration-200 border ${inputBg} ${inputBorder} ${inputFocus} ${inputText} ${inputPlaceholder}`;
  const buttonPrimary = "bg-blue-600 hover:bg-blue-500 text-white";
  const linkText = "text-blue-400 hover:text-blue-300 hover:underline transition-colors";

  return (
    <div
      className={`min-h-screen flex items-center justify-center font-sans selection:bg-blue-500/30 transition-colors duration-200 ${pageBg}`}
    >
      {/* Card container */}
      <div
        className={`p-8 rounded-2xl border w-full max-w-sm transition-colors duration-200 ${cardBg} ${borderColor} ${shadow}`}
      >
        {/* Logo / Branding */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-1">🚀</div>
          <h1 className={`text-lg font-semibold ${isWhiteTheme ? "text-gray-800" : "text-white"}`}>
            MockAPI
          </h1>
          <p className={`text-xs ${labelText}`}>Sign in to your account</p>
        </div>

        {/* Username */}
        <div className="mb-4">
          <label className={`block text-xs font-medium mb-1.5 ${labelText}`}>
            Username
          </label>
          <input
            onChange={(e) => setUsername(e.target.value)}
            value={username}
            disabled={isLoading}
            placeholder="Enter your username"
            className={inputBase}
          />
        </div>

        {/* Password */}
        <div className="mb-4">
          <label className={`block text-xs font-medium mb-1.5 ${labelText}`}>
            Password
          </label>
          <input
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
            disabled={isLoading}
            placeholder="Enter your password"
            className={inputBase}
          />
        </div>

        {/* Forgot password & Sign up */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleSignup}
            disabled={isLoading}
            className={`text-xs ${linkText}`}
          >
            Create account →
          </button>
          <button
            onClick={() => navigate("/forgot-password")}
            disabled={isLoading}
            className={`text-xs ${linkText}`}
          >
            Forgot password?
          </button>
        </div>

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${buttonPrimary} disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Logging in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className={`absolute inset-0 flex items-center ${isWhiteTheme ? "text-gray-300" : "text-zinc-700"}`}>
            <div className="w-full border-t border-current" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className={`px-2 ${cardBg} ${labelText}`}>or</span>
          </div>
        </div>

        {/* Guest login */}
        <button
          onClick={async () => {
            try {
              const isAuthenticated = await authenticateUser("guest", "guest");
              if (isAuthenticated) {
                await login({ username: "Guest", role: "guest" });
                navigate("/");
              }
            } catch {
              // silent
            }
          }}
          disabled={isLoading}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border ${isWhiteTheme ? "border-gray-300 hover:bg-gray-50 text-gray-600" : "border-zinc-700 hover:bg-zinc-800 text-zinc-400"} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"} disabled:opacity-50`}
        >
          Continue as Guest
        </button>

        {/* Footer */}
        <div className={`mt-6 text-center text-[10px] ${labelText}`}>
          <span>MockAPI v1.0</span>
          <span className="mx-2">•</span>
          <span>Secure • Encrypted</span>
        </div>
      </div>
    </div>
  );
}

export default Login;