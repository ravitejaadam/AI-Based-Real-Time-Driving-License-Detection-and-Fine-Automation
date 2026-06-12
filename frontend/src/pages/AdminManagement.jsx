import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as authService from '../services/authService';

const AdminManagement = () => {
  const { token, isSuperAdmin, user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const stats = useMemo(() => ({
    total: admins.length,
    active: admins.filter((admin) => admin.status === 'active').length,
    inactive: admins.filter((admin) => admin.status === 'inactive').length,
  }), [admins]);

  const loadAdmins = async () => {
    console.log('Current Role:', user?.role);
    const canViewAdmins = user?.role === 'super_admin';
    console.log('Can View Admins:', canViewAdmins);

    setLoading(true);
    setError('');

    try {
      const response = await authService.fetchAdmins(token);
      console.log('AdminManagement: fetchAdmins response payload:', response);
      console.log('Admin Query Result:', response);
      console.log('Admin Query Error:', response?.error || null);
      const adminList = Array.isArray(response)
        ? response
        : Array.isArray(response?.admins)
          ? response.admins
          : [];
      setAdmins(adminList);
      console.log('AdminManagement: Admins (raw):', adminList);
      console.log('AdminManagement: Admins count:', adminList.length);
      console.log('Admins State:', adminList);
    } catch (err) {
      console.error('AdminManagement: fetchAdmins error:', err);
      setError(err.message || 'Unable to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Current User:', user?.id);
    console.log('Loading admins...');
    if (!token || !isSuperAdmin) {
      console.log('No valid super admin session, clearing admin list and skipping load');
      setAdmins([]);
      setLoading(false);
      return;
    }

    loadAdmins();
  }, [token, user?.role, isSuperAdmin]);

  useEffect(() => {
    if (!user) {
      console.log('User logged out, clearing admins state');
      setAdmins([]);
    }
  }, [user]);

  console.log('Admins:', admins);

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCreateAdmin = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setSubmitting(true);

    try {
      await authService.createAdmin(token, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });

      setMessage('Admin account created successfully.');
      setForm({ name: '', email: '', phone: '', password: '' });
      await loadAdmins();
    } catch (err) {
      setError(err.message || 'Failed to create admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (adminId, status) => {
    setError('');
    setMessage('');

    try {
      await authService.updateAdminStatus(token, adminId, status);
      setMessage(`Admin ${status === 'active' ? 'activated' : 'deactivated'} successfully.`);
      await loadAdmins();
    } catch (err) {
      setError(err.message || 'Unable to update admin status.');
    }
  };

  const handleDeleteClick = (admin) => {
    setError('');
    setMessage('');
    setDeleteTarget(admin);
  };

  const handleCancelDelete = () => {
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setError('');
    setMessage('');

    try {
      await authService.deleteAdmin(token, deleteTarget.id);
      setMessage('Administrator deleted successfully.');
      setDeleteTarget(null);
      await loadAdmins();
    } catch (err) {
      setError(err.message || 'Unable to delete administrator account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-surface/80 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Total Admins</p>
          <p className="mt-4 text-4xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-surface/80 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Active Admins</p>
          <p className="mt-4 text-4xl font-bold text-white">{stats.active}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-surface/80 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Inactive Admins</p>
          <p className="mt-4 text-4xl font-bold text-white">{stats.inactive}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Admin Registry</h2>
              <p className="text-sm text-gray-400">Manage all administrator accounts from a secure dashboard.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-primary">Super Admin</span>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-200">
              {message}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-white/90">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-gray-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-sm text-gray-400">Loading admins…</td>
                  </tr>
                ) : admins.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-sm text-gray-400">No admin accounts found.</td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.id} className="border-b border-white/10 last:border-b-0">
                      <td className="px-4 py-4">{admin.name}</td>
                      <td className="px-4 py-4">{admin.email}</td>
                      <td className="px-4 py-4">{admin.phone || '-'}</td>
                      <td className="px-4 py-4 capitalize text-sm text-white/90">
                        <span className={`inline-flex rounded-full px-3 py-1 ${admin.status === 'active' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200'}`}>
                          {admin.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">{admin.created_at ? new Date(admin.created_at).toLocaleString() : '-'}</td>
                      <td className="px-4 py-4 space-x-2 whitespace-nowrap">
                        {admin.status !== 'active' && (
                          <button
                            className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15"
                            onClick={() => handleStatusChange(admin.id, 'active')}
                          >
                            Activate
                          </button>
                        )}
                        {admin.status === 'active' && (
                          <button
                            className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/15"
                            onClick={() => handleStatusChange(admin.id, 'inactive')}
                          >
                            Deactivate
                          </button>
                        )}
                        <button
                          disabled
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-400 cursor-not-allowed"
                          title="Password reset is planned for future release"
                        >
                          Reset Password
                        </button>
                        {isSuperAdmin && (
                          <button
                            className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/15"
                            onClick={() => handleDeleteClick(admin)}
                            type="button"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-surface/80 p-6">
          <h2 className="text-2xl font-bold mb-2">Create Admin</h2>
          <p className="text-sm text-gray-400 mb-6">Create new administrator accounts with active access by default.</p>

          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <label className="block text-sm font-medium text-gray-200">
              Name
              <input
                value={form.name}
                onChange={(event) => handleChange('name', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
                placeholder="Admin name"
                required
              />
            </label>

            <label className="block text-sm font-medium text-gray-200">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
                placeholder="admin@example.com"
                required
              />
            </label>

            <label className="block text-sm font-medium text-gray-200">
              Phone
              <input
                value={form.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
                placeholder="+1 555 123 4567"
              />
            </label>

            <label className="block text-sm font-medium text-gray-200">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => handleChange('password', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
                placeholder="Strong admin password"
                required
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create Admin'}
            </button>

            <p className="text-xs text-gray-500">Passwords must be at least 8 characters and include uppercase, lowercase, and numbers.</p>
          </form>
        </section>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-2xl ring-1 ring-white/10">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white">Delete Administrator</h3>
              <p className="mt-2 text-sm text-gray-400">
                Are you sure you want to permanently delete this administrator account? This action cannot be undone.
              </p>
            </div>
            <div className="rounded-3xl bg-background/80 p-4 text-sm text-gray-300">
              <p className="font-semibold text-white">Administrator</p>
              <p className="mt-1">{deleteTarget.name} ({deleteTarget.email})</p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;
