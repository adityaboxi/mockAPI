import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import OTP from './pages/OTP';
import TermsCondition from './pages/TermsCondition';
import Setting from './pages/Setting';
import ManageAccount from './pages/ManageAccount';
import Subscribe from './pages/Subscribe';
import TitleUpdater from './components/TitleUpdater';
import NetworkTest from './pages/NetworkTest';
import OpenApi from './pages/OpenApi';
import Dashboard from './pages/Dashboard';
import ApiToolsPage from './pages/ApiToolsPage';
import GeneralQuestionPage from './pages/GeneralQuestionPage'; // ✅ NEW

function App() {
  return (
    <>
      <TitleUpdater />
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/otp" element={<OTP />} />
        <Route path="/home" element={<Home />} />
        <Route path="/terms" element={<TermsCondition />} />
        <Route path="/setting" element={<Setting />} />
        <Route path="/manageaccount" element={<ManageAccount />} />
        <Route path="/subscribe" element={<Subscribe />} />

        <Route path="/tools" element={<ApiToolsPage />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* ✅ New route for first‑time user onboarding */}
        <Route path="/general-questions" element={<GeneralQuestionPage />} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </>
  );
}

export default App;