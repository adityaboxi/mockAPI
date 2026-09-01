require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

async function logout(req, res) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === 'true';
  const sameSite = process.env.COOKIE_SAMESITE || (isHttps ? 'none' : 'lax');
  const isSecure = isHttps;

  res.clearCookie('token', {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    path: '/',
  });
  res.clearCookie('guest_token', {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    path: '/',
  });
  return res.json({ success: true, message: 'Logged out successfully' });
}

module.exports = logout;