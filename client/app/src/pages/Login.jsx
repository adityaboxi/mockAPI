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
     
     
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center font-sans selection:bg-blue-500/30 ${
      isWhiteTheme ? "bg-gray-100" : "bg-[#1e1e24]"
    }`}>
      <div className={`p-8 rounded shadow-lg border w-full max-w-sm ${
        isWhiteTheme ? "bg-white border-gray-200" : "bg-[#2b2d31] border-zinc-700/50"
      }`}>
        <div className="mb-4">
          <h1 className={`text-xs font-medium mb-1 ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>
            username
          </h1>
          <input
            onChange={(e) => setUsername(e.target.value)}
            value={username}
            disabled={isLoading}
            className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
              isWhiteTheme
                ? "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500"
                : "bg-[#1e1f22] border border-zinc-700/50 text-gray-200 placeholder-zinc-600 focus:border-blue-500"
            }`}
          />
        </div>

        <div className="mb-4">
          <h1 className={`text-xs font-medium mb-1 ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>
            password
          </h1>
          <input
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
            disabled={isLoading}
            className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
              isWhiteTheme
                ? "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500"
                : "bg-[#1e1f22] border border-zinc-700/50 text-gray-200 placeholder-zinc-600 focus:border-blue-500"
            }`}
          />
        </div>

        <div className="mb-6">
          <span className={`text-xs inline-block mr-2 ${isWhiteTheme ? "text-gray-500" : "text-gray-500"}`}>
            not logged in?
          </span>
          <button
            onClick={handleSignup}
            disabled={isLoading}
            className="text-blue-400 hover:text-blue-300 hover:underline text-xs transition-colors"
          >
            Sign Up
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded text-sm transition-colors disabled:opacity-50"
        >
          {isLoading ? "Logging in..." : "login"}
        </button>
      </div>
    </div>
  );
}

export default Login;