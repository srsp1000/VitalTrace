import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AdminForbiddenScreen } from './AdminForbiddenScreen';

interface RequireAdminProps {
  children?: React.ReactNode;
}

export const RequireAdmin: React.FC<RequireAdminProps> = ({ children }) => {
  const { currentUser, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 space-y-3">
        <div className="w-9 h-9 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Verifying administrative credentials...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role !== 'admin') {
    return <AdminForbiddenScreen />;
  }

  return children ? <>{children}</> : <Outlet />;
};
