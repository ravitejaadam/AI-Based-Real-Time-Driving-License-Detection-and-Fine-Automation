import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    console.log('Login.jsx useEffect triggered - user state:', user);
    console.log('Loading state:', loading);
    if (user) {
      console.log('User found, navigating from:', from);
      console.log('User object:', user);
      try {
        navigate(from, { replace: true });
        console.log('Navigation called successfully');
      } catch (navErr) {
        console.error('Navigation error:', navErr);
      }
    } else {
      console.log('No user, staying on login page');
    }
  }, [user, navigate, from]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    console.log('Login clicked with email:', email);
    setError('');
    setLoading(true);

    try {
      console.log('Calling login with credentials...');
      const result = await login(email.trim(), password);
      console.log('Login API returned:', result);
      console.log('Type of result:', typeof result);
      console.log('Result keys:', Object.keys(result || {}));
      
      if (!result) {
        throw new Error('Login returned null');
      }
      
      console.log('Login succeeded, result:', result);
      console.log('About to navigate to:', from);
      // Note: Don't navigate here, let useEffect handle it when user state updates
    } catch (err) {
      console.error('Login error caught in component:', err.message, err);
      setError(err.message || 'Unable to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/95 p-8 shadow-2xl shadow-black/30">
        <h1 className="text-3xl font-bold mb-2">Traffic Monitoring Login</h1>
        <p className="mb-8 text-sm text-gray-400">Enter your admin credentials to access the monitoring system.</p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm font-medium text-gray-200">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
              placeholder="admin@traffic.com"
              required
            />
          </label>

          <label className="block text-sm font-medium text-gray-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
              placeholder="Enter your password"
              required
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
