import { Alert, Button, PageHeader } from '@vitru/styleguide';
import { LogIn } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { safeReturnPath } from '../services/authService';
import { useAuth } from './authContext';
import styles from './LoginPage.module.css';

interface LoginLocationState {
  readonly from?: string;
}

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LoginLocationState | null;
  const requestedPath = safeReturnPath(state?.from);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void navigate(auth.takeReturnPath() ?? requestedPath, { replace: true });
    }
  }, [auth, navigate, requestedPath]);

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      const cleanup = auth.initializeOneTap(requestedPath);
      return cleanup;
    }
  }, [auth, requestedPath]);

  const isBusy = auth.status === 'initializing' || auth.status === 'authenticating';

  return (
    <main className={styles.page}>
      <section className={styles.login} aria-label="Acesso interno">
        <div className={styles.brand}>
          <img src="/favicon.svg" alt="" width="32" height="32" />
          <span>Short Links</span>
        </div>
        <PageHeader
          title="Acesso interno"
          description="Crie links curtos, gerencie destinos e acompanhe os acessos da sua equipe."
        />
        <div className={styles.action}>
          <p>Entre com sua conta Google para acessar suas equipes.</p>

          {auth.error ? (
            <Alert variant="danger" title="Não foi possível entrar">
              {auth.error.message}
            </Alert>
          ) : null}

          <Button type="button" disabled={isBusy} onClick={() => void auth.signIn(requestedPath)}>
            <LogIn className="icon icon-sm" aria-hidden="true" />
            {isBusy ? 'Conectando...' : 'Entrar com Google'}
          </Button>
        </div>

        <p className={styles.note}>Recebeu um convite? Entre para acessar a equipe.</p>
      </section>
    </main>
  );
}
