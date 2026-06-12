const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

function getHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function request(path, options = {}) {
  console.log(`API request to ${path}`);
  const response = await fetch(`${API_BASE}${path}`, options);
  console.log(`API response status: ${response.status}`);
  const body = await response.json().catch(() => null);
  console.log(`API response body:`, body);

  if (!response.ok) {
    const error = body?.error || body?.message || 'An unexpected error occurred';
    console.error(`API error: ${error}`);
    throw new Error(error);
  }

  return body;
}

export async function login(email, password) {
  if (!email || !password) {
    throw new Error('Please provide both email and password.');
  }

  console.log('authService.login() called for email:', email);
  try {
    const result = await request('/auth/login', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    console.log('authService.login() result:', result);
    return result;
  } catch (err) {
    console.error('authService.login() error:', err.message);
    throw err;
  }
}

export async function validateSession(token) {
  if (!token) {
    throw new Error('Missing session token.');
  }

  return request('/auth/validate', {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ token }),
  });
}

export async function fetchAdmins(token) {
  return request('/admins', {
    method: 'GET',
    headers: getHeaders(token),
  });
}

export async function createAdmin(token, adminData) {
  return request('/admins', {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(adminData),
  });
}

export async function updateAdminStatus(token, adminId, status) {
  return request(`/admins/${adminId}/status`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({ status }),
  });
}

export async function deleteAdmin(token, adminId) {
  return request(`/admins/${adminId}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
}

export async function fetchProfile(token) {
  return request('/auth/validate', {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ token }),
  });
}
