import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext'; // adjust path

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { theme } = useTheme(); // 'dark' or 'white'
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // ─── Helper: return styles based on theme ──────────────────────────────
  const getThemeStyles = () => {
    const isDark = theme === 'dark';
    return {
      container: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        color: isDark ? '#e5e7eb' : '#1f2937',
        borderColor: isDark ? '#374151' : '#e5e7eb',
      },
      input: {
        backgroundColor: isDark ? '#374151' : '#ffffff',
        color: isDark ? '#f3f4f6' : '#1f2937',
        borderColor: isDark ? '#4b5563' : '#d1d5db',
      },
      label: {
        color: isDark ? '#d1d5db' : '#374151',
      },
      helperText: {
        color: isDark ? '#9ca3af' : '#6b7280',
      },
      primaryButton: {
        backgroundColor: isDark ? '#3b82f6' : '#2563eb',
        color: '#ffffff',
      },
      primaryButtonHover: {
        backgroundColor: isDark ? '#2563eb' : '#1d4ed8',
      },
      successButton: {
        backgroundColor: isDark ? '#22c55e' : '#16a34a',
        color: '#ffffff',
      },
      link: {
        color: isDark ? '#60a5fa' : '#2563eb',
      },
      messageError: {
        backgroundColor: isDark ? '#7f1d1d' : '#fee2e2',
        color: isDark ? '#fca5a5' : '#b91c1c',
      },
      messageSuccess: {
        backgroundColor: isDark ? '#14532d' : '#dcfce7',
        color: isDark ? '#86efac' : '#166534',
      },
      messageInfo: {
        backgroundColor: isDark ? '#1e3a5f' : '#dbeafe',
        color: isDark ? '#93c5fd' : '#1e40af',
      },
    };
  };

  const styles = getThemeStyles();

  // ─── UI helpers ──────────────────────────────────────────────────────────
  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  // ─── API handlers ────────────────────────────────────────────────────────
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      return showMessage('Please enter your username or email.', 'error');
    }
    setLoading(true);
    try {
      await axios.post('/api/forgot-password', { identifier });
      showMessage('If an account with that username/email exists, an OTP has been sent to your email.', 'success');
      setStep(2);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to send OTP. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      return showMessage('Please enter a valid 6-digit OTP.', 'error');
    }
    setLoading(true);
    try {
      const { data } = await axios.post('/api/verify-forgot-otp', { identifier, otp });
      setResetToken(data.resetToken);
      showMessage('OTP verified! Now set your new password.', 'success');
      setStep(3);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Invalid or expired OTP.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      return showMessage('Password must be at least 6 characters.', 'error');
    }
    if (newPassword !== confirmPassword) {
      return showMessage('Passwords do not match.', 'error');
    }
    setLoading(true);
    try {
      await axios.post('/api/reset-password', { resetToken, newPassword });
      showMessage('Password reset successfully! Redirecting to login...', 'success');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to reset password. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep(1);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResetToken('');
    setMessage({ text: '', type: '' });
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className="max-w-md mx-auto mt-12 p-6 rounded-lg shadow-md"
      style={styles.container}
    >
      <h2 className="text-2xl font-bold text-center mb-6" style={{ color: styles.container.color }}>
        Forgot Password
      </h2>

      {message.text && (
        <div
          className="mb-4 p-3 rounded text-sm"
          style={
            message.type === 'error'
              ? styles.messageError
              : message.type === 'success'
              ? styles.messageSuccess
              : styles.messageInfo
          }
        >
          {message.text}
        </div>
      )}

      {/* Step 1: Request OTP */}
      {step === 1 && (
        <form onSubmit={handleRequestOTP}>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2" style={styles.label}>
              Username or Email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter your username or email"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={styles.input}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md disabled:opacity-50 transition-colors"
            style={{
              ...styles.primaryButton,
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) Object.assign(e.target.style, styles.primaryButtonHover);
            }}
            onMouseLeave={(e) => {
              if (!loading) Object.assign(e.target.style, styles.primaryButton);
            }}
          >
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm hover:underline"
              style={styles.link}
            >
              Back to Login
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Verify OTP */}
      {step === 2 && (
        <form onSubmit={handleVerifyOTP}>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2" style={styles.label}>
              Enter OTP
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit OTP"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={styles.input}
              disabled={loading}
            />
            <p className="text-xs mt-1" style={styles.helperText}>
              Check your email for the OTP (valid for 10 min).
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md disabled:opacity-50 transition-colors"
            style={{
              ...styles.primaryButton,
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) Object.assign(e.target.style, styles.primaryButtonHover);
            }}
            onMouseLeave={(e) => {
              if (!loading) Object.assign(e.target.style, styles.primaryButton);
            }}
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={goBack}
              className="text-sm hover:underline"
              style={styles.link}
            >
              ← Request new OTP
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Reset Password */}
      {step === 3 && (
        <form onSubmit={handleResetPassword}>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2" style={styles.label}>
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              style={styles.input}
              disabled={loading}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2" style={styles.label}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              style={styles.input}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md disabled:opacity-50 transition-colors"
            style={{
              ...styles.successButton,
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = theme === 'dark' ? '#16a34a' : '#15803d';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = styles.successButton.backgroundColor;
              }
            }}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={goBack}
              className="text-sm hover:underline"
              style={styles.link}
            >
              ← Start over
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ForgotPassword;