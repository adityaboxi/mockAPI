import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

function Signup() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isEmailValid, setIsEmailValid] = useState(null);
  const [isUsernameValid, setIsUsernameValid] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const isWhiteTheme = theme === "white";

  // Dedicated environment variables for validation and signup endpoints
  const VALID_EMAIL_URL = import.meta.env.VITE_API_URL_VALIDEMAIL;
  const VALID_USERNAME_URL = import.meta.env.VITE_API_URL_VALIDUSERNAME;
  const SIGNUP_URL = import.meta.env.VITE_API_URL_SIGNUP; // points to /api/setuser

  const checkEmail = async () => {
    if (!email) return;
    try {
      const response = await fetch(VALID_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setIsEmailValid(response.status === 200);
    } catch {
      setIsEmailValid(false);
    }
  };

  const checkUsername = async () => {
    if (!username) return;
    try {
      const response = await fetch(VALID_USERNAME_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      setIsUsernameValid(response.status === 200);
    } catch {
      setIsUsernameValid(false);
    }
  };

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      return;
    }
    if (isEmailValid === false || isUsernameValid === false) {
      return;
    }
    if (!name || !email || !username || !password) {
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
      } else {
        const errorData = await response.json().catch(() => ({}));
        // Optionally handle error
      }
    } catch {
      // Network error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center py-8 px-4 ${
      isWhiteTheme ? "bg-gray-100" : "bg-[#1e1e24]"
    } font-sans selection:bg-blue-500/30`}>
      <div className={`p-8 rounded shadow-lg border w-full max-w-sm ${
        isWhiteTheme ? "bg-white border-gray-200" : "bg-[#2b2d31] border-zinc-700/50"
      }`}>
        <div className="mb-4">
          <h1 className={`text-xs font-medium mb-1 ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>name:</h1>
          <input
            onChange={(e) => setName(e.target.value)}
            value={name}
            disabled={isLoading}
            className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
              isWhiteTheme
                ? "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500"
                : "bg-[#1e1f22] border border-zinc-700/50 text-gray-200 placeholder-zinc-600 focus:border-blue-500"
            }`}
          />
        </div>

        <div className="mb-4">
          <h1 className={`text-xs font-medium mb-1 ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>emailid:</h1>
          <input
            onChange={(e) => { setEmail(e.target.value); setIsEmailValid(null); }}
            onBlur={checkEmail}
            value={email}
            disabled={isLoading}
            type="email"
            className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
              isWhiteTheme
                ? "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500"
                : "bg-[#1e1f22] border border-zinc-700/50 text-gray-200 placeholder-zinc-600 focus:border-blue-500"
            }`}
          />
          {isEmailValid === true && <p className="text-[11px] text-green-400 mt-1">email valid</p>}
          {isEmailValid === false && <p className="text-[11px] text-red-400 mt-1">email already present</p>}
        </div>

        <div className="mb-4">
          <h1 className={`text-xs font-medium mb-1 ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>username:</h1>
          <input
            onChange={(e) => { setUsername(e.target.value); setIsUsernameValid(null); }}
            onBlur={checkUsername}
            value={username}
            disabled={isLoading}
            className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
              isWhiteTheme
                ? "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500"
                : "bg-[#1e1f22] border border-zinc-700/50 text-gray-200 placeholder-zinc-600 focus:border-blue-500"
            }`}
          />
          {isUsernameValid === true && <p className="text-[11px] text-green-400 mt-1">username valid</p>}
          {isUsernameValid === false && <p className="text-[11px] text-red-400 mt-1">username already present</p>}
        </div>

        <div className="mb-4">
          <h1 className={`text-xs font-medium mb-1 ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>new password:</h1>
          <input
            onChange={(e) => setPassword(e.target.value)}
            value={password}
            type="password"
            disabled={isLoading}
            className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
              isWhiteTheme
                ? "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500"
                : "bg-[#1e1f22] border border-zinc-700/50 text-gray-200 placeholder-zinc-600 focus:border-blue-500"
            }`}
          />
        </div>

        <div className="mb-4">
          <h1 className={`text-xs font-medium mb-1 ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>confirm password:</h1>
          <input
            onChange={(e) => setConfirmPassword(e.target.value)}
            value={confirmPassword}
            type="password"
            disabled={isLoading}
            className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
              isWhiteTheme
                ? "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500"
                : "bg-[#1e1f22] border border-zinc-700/50 text-gray-200 placeholder-zinc-600 focus:border-blue-500"
            }`}
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-[11px] text-red-400 mt-1">passwords do not match</p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <button
            onClick={handleSignup}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded text-sm transition-colors disabled:opacity-50"
          >
            {isLoading ? "Signing up..." : "signup"}
          </button>
          {password !== confirmPassword && (
            <p className="text-[11px] text-red-400 text-center">password doesn't match</p>
          )}
          {(isEmailValid === false || isUsernameValid === false) && (
            <p className="text-[11px] text-red-400 text-center">there is some error</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Signup;