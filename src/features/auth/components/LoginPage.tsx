import { Alert, Button, PageHeader } from '@vitru/styleguide';
import { Link2, LogIn } from 'lucide-react';
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

  const isBusy = auth.status === 'initializing' || auth.status === 'authenticating';

  return (
    <main className={styles.page}>
      <section className={styles.login} aria-labelledby="login-title">
        <div className={styles.brand} aria-hidden="true">
          <Link2 className="icon" />
        </div>
        <PageHeader
          title="Short Links"
          description="Entre para criar endereços memoráveis e acompanhar os acessos da sua equipe."
        />

        <div className={styles.action}>
          <h1 id="login-title">Acesso interno</h1>
          <p>Use sua conta Google. Nenhuma senha é armazenada pelo Short Links.</p>

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

        <p className={styles.note}>O acesso administrativo exige uma sessão válida.</p>
      </section>
    </main>
  );
}
