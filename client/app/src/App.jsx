// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// ─── Pages ──────────────────────────────────────────────────────────
import Login from './pages/Login';
import Signup from './pages/Signup';
import OTP from './pages/OTP';
import GeneralQuestionPage from './pages/GeneralQuestionPage';
import Home from './pages/Home';
import Setting from './pages/Setting';
import ManageAccount from './pages/ManageAccount';
import Subscribe from './pages/Subscribe';
import TermsCondition from './pages/TermsCondition';
import Dashboard from './pages/Dashboard';
import ApiToolsPage from './pages/ApiToolsPage';
import NetworkTest from './pages/NetworkTest';      // (used inside ApiToolsPage)
import OpenApi from './pages/OpenApi';              // (used inside ApiToolsPage)
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from "./pages/ChangePassword";
// ─── Components ────────────────────────────────────────────────────
import TitleUpdater from './components/TitleUpdater';

function App() {
  return (
    <>
      <TitleUpdater />
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
        <Route path="/manageaccount" element={<ManageAccount />} />
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
    </>
  );
}

export default App;