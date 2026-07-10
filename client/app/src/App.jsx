/*import React from 'react';
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
      <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      </>
  );
}

export default App;*/



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
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </>
  );
}

export default App;
