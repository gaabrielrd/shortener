import { Button } from '@vitru/styleguide';
import { Home, LogOut, Palette } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { useAuth } from '@/features/auth';
import styles from './App.module.css';

const PROJECT_NAME = 'Short Links';

export function App() {
  const auth = useAuth();

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img className={styles.mark} src="/favicon.svg" alt="" width="28" height="28" />
          <h1>{PROJECT_NAME}</h1>
        </div>

        <div className={styles.session}>
          <p className={styles.status}>
            <span>{auth.user?.displayName}</span>
            <small>{auth.user?.email}</small>
          </p>
          <Button type="button" variant="secondary" onClick={() => void auth.signOut()}>
            <LogOut className="icon icon-sm" aria-hidden="true" />
            Sair
          </Button>
        </div>

        <nav className={styles.nav} aria-label="Navegação principal">
          <Link to="/app">
            <Home className="icon icon-sm" aria-hidden="true" />
            Início
          </Link>
          <Link to="/styleguide">
            <Palette className="icon icon-sm" aria-hidden="true" />
            Styleguide
          </Link>
        </nav>
      </header>

      <Outlet />
    </main>
  );
}
