const express = require('express');
const router = express.Router();
const { loginUser, validateToken } = require('../services/authService');

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  console.log('POST /api/auth/login received with email:', email);

  if (!email || !password) {
    console.error('Missing email or password');
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    console.log('Calling loginUser for email:', email);
    const result = await loginUser(email.trim().toLowerCase(), password);
    console.log('loginUser result:', result);
    return res.json(result);
  } catch (error) {
    const message = error.message || 'Unable to sign in.';
    console.error('Login error:', message, 'Status:', error.status);
    return res.status(error.status || 401).json({ error: message });
  }
});

router.post('/validate', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim() || req.body?.token;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }

  try {
    const result = await validateToken(token);
    return res.json(result);
  } catch (error) {
    const message = error.message || 'Session validation failed.';
    return res.status(error.status || 401).json({ error: message });
  }
});

module.exports = router;
