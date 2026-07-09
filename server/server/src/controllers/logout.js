async function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE,
    path: '/'
  });
  res.clearCookie('guest_token', {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE,
    path: '/'
  });
  res.json({ success: true, message: 'Logged out successfully' });
}

module.exports = logout;