require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

async function logout(req, res) {
  const isProd = process.env.NODE_ENV === 'production';

  res.clearCookie('token', {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    secure: isProd,
    path: '/',
  });
  res.clearCookie('guest_token', {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    secure: isProd,
    path: '/',
  });
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}

module.exports = logout;