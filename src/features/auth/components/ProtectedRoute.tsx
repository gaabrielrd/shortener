import { LoadingState } from '@vitru/styleguide';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './authContext';
import styles from './ProtectedRoute.module.css';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'initializing' || auth.status === 'authenticating') {
    return (
      <main className={styles.state}>
        <LoadingState label="Restaurando sua sessão..." />
      </main>
    );
  }

  if (auth.status !== 'authenticated') {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}
