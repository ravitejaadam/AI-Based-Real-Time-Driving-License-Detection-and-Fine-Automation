import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  console.log('[RequireAuth]', { 
    timestamp: new Date().toISOString(),
    userId: user?.id, 
    userRole: user?.role, 
    loading, 
    pathname: location.pathname,
    userExists: !!user
  });

  if (loading) {
    console.log('[RequireAuth] In loading state, showing restore message');
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <p>Restoring session...</p>
      </div>
    );
  }

  if (!user) {
    console.log('[RequireAuth] No user, redirecting to /login from', location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('[RequireAuth] User authenticated, rendering protected content for', location.pathname);
  return children;
};

export const RequireSuperAdmin = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  console.log('RequireSuperAdmin:', { user: user?.id, userRole: user?.role, loading, pathname: location.pathname });

  if (loading) {
    console.log('RequireSuperAdmin: Loading state, showing check access message');
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <p>Checking access...</p>
      </div>
    );
  }

  if (!user) {
    console.log('RequireSuperAdmin: No user, redirecting to /login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'super_admin') {
    console.log('RequireSuperAdmin: User role is not super_admin, redirecting to /');
    return <Navigate to="/" replace />;
  }

  console.log('RequireSuperAdmin: User is super_admin, rendering protected content');
  return children;
};
