// src/App.jsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';

// ─── Eagerly Loaded Global Shell Components ──────────────────────────
import TitleUpdater from './components/TitleUpdater';
import ToastContainer from './components/ToastContainer';
import CommandPalette from './components/CommandPalette';

// ─── Resilient Chunk Loading (Auto-Recovers after new deployments) ────
const lazyWithRetry = (importFn) =>
  lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      // If a new build was deployed and chunk hashes changed, reload to fetch newest HTML
      const isRetried = window.sessionStorage.getItem('chunk_retry_occurred') === 'true';
      if (!isRetried) {
        window.sessionStorage.setItem('chunk_retry_occurred', 'true');
        window.location.reload();
        return new Promise(() => {}); // Hold until reload
      }
      window.sessionStorage.removeItem('chunk_retry_occurred');
      throw error;
    }
  });

// ─── Route-Level Code Splitting (Lazy-Loaded Pages) ─────────────────
const Home = lazyWithRetry(() => import('./pages/Home'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const Signup = lazyWithRetry(() => import('./pages/Signup'));
const OTP = lazyWithRetry(() => import('./pages/OTP'));
const GeneralQuestionPage = lazyWithRetry(() => import('./pages/GeneralQuestionPage'));
const Setting = lazyWithRetry(() => import('./pages/Setting'));
const ManageAccount = lazyWithRetry(() => import('./pages/ManageAccount'));
const Subscribe = lazyWithRetry(() => import('./pages/Subscribe'));
const TermsCondition = lazyWithRetry(() => import('./pages/TermsCondition'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const ApiToolsPage = lazyWithRetry(() => import('./pages/ApiToolsPage'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const ChangePassword = lazyWithRetry(() => import('./pages/ChangePassword'));

function RouteLoadingFallback() {
  const { theme } = useTheme();
  const isWhiteTheme = theme === 'white';

  return (
    <div
      className={`h-screen w-full flex flex-col items-center justify-center font-mono text-xs select-none transition-colors duration-150 ${
        isWhiteTheme ? 'bg-gray-50 text-gray-500' : 'bg-[#09090b] text-zinc-400'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
        <span className={`font-semibold tracking-wider ${isWhiteTheme ? 'text-gray-700' : 'text-zinc-300'}`}>
          Loading module...
        </span>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <TitleUpdater />
      <ToastContainer />
      <CommandPalette />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Redirect root to home */}
          <Route path="/" element={<Navigate to="/home" replace />} />

          {/* Authentication & Onboarding */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/otp" element={<OTP />} />
          <Route path="/general-questions" element={<GeneralQuestionPage />} />

          {/* Core Application */}
          <Route path="/home" element={<Home />} />
          <Route path="/setting" element={<Setting />} />
          <Route path="/settings" element={<Setting />} />
          <Route path="/manageaccount" element={<ManageAccount />} />
          <Route path="/manage-account" element={<ManageAccount />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/terms" element={<TermsCondition />} />

          {/* Tools & Analytics */}
          <Route path="/tools" element={<ApiToolsPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/change-password" element={<ChangePassword />} />

          {/* Fallback – any unknown route goes home */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;