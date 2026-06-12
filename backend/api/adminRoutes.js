const express = require('express');
const router = express.Router();
const { requireSuperAdminToken } = require('../services/authService');
const { getAdmins, createAdminProfile, updateAdminStatus, deleteAdminProfile, getProfileById } = require('../services/profileService');
const { logAdminAction } = require('../services/activityService');

router.use(async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }

  try {
    const currentUser = await requireSuperAdminToken(token);
    req.currentUser = currentUser;
    next();
  } catch (error) {
    return res.status(error.status || 401).json({ error: error.message || 'Unauthorized access.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const admins = await getAdmins();
    return res.json({ admins });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch admins.' });
  }
});

router.post('/', async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  const createdBy = req.currentUser?.id;

  console.log('Creating admin...', { name, email, phone, createdBy });
  console.log('Current super admin:', req.currentUser);

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const adminProfile = await createAdminProfile({ name, email, phone, password, createdBy });
    await logAdminAction(adminProfile.id, 'Admin Created');

    return res.status(201).json({ admin: adminProfile });
  } catch (error) {
    console.error('Admin creation failed:', error.message || error, { stack: error.stack });
    return res.status(error.status || 400).json({ error: error.message || 'Failed to create admin.' });
  }
});

router.patch('/:adminId/status', async (req, res) => {
  const adminId = req.params.adminId;
  const { status } = req.body || {};

  if (!adminId || !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'A valid status value is required.' });
  }

  try {
    const adminProfile = await getProfileById(adminId);

    if (!adminProfile.profile || adminProfile.profile.role !== 'admin') {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    await updateAdminStatus(adminId, status);
    await logAdminAction(adminId, status === 'active' ? 'Admin Activated' : 'Admin Deactivated');

    return res.json({ status: 'ok' });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Unable to update admin status.' });
  }
});

router.delete('/:adminId', async (req, res) => {
  const adminId = req.params.adminId;
  const deletedBy = req.currentUser?.id;

  if (!adminId) {
    return res.status(400).json({ error: 'Administrator id is required.' });
  }

  if (adminId === deletedBy) {
    return res.status(403).json({ error: 'Super Admin accounts cannot be deleted.' });
  }

  try {
    const adminProfile = await getProfileById(adminId);

    if (!adminProfile.profile) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    if (adminProfile.profile.role === 'super_admin') {
      return res.status(403).json({ error: 'Super Admin accounts cannot be deleted.' });
    }

    await deleteAdminProfile(adminId, deletedBy);
    await logAdminAction(adminId, 'Admin Deleted', deletedBy);

    return res.json({ status: 'ok' });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Unable to delete admin account.' });
  }
});

module.exports = router;
