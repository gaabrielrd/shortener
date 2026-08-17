import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Plus } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth';
import { CreateTeamDialog } from '@/features/teams';
import styles from './App.module.css';

const PROJECT_NAME = 'Short Links';

export function App() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <Link to="/app" className={styles.brand} aria-label="Ir para o início do Short Links">
          <img className={styles.mark} src="/favicon.svg" alt="" width="28" height="28" />
          <h1>{PROJECT_NAME}</h1>
        </Link>

        {auth.user ? (
          <div className={styles.userMenuContainer} ref={menuRef}>
            <button
              type="button"
              className={styles.userMenuTrigger}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={`Menu de ${auth.user.displayName}`}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className={styles.status}>
                <span className={styles.userName}>{auth.user.displayName}</span>
                <small className={styles.userEmail}>{auth.user.email}</small>
              </span>
              <ChevronDown
                className={`icon icon-sm ${styles.chevron} ${menuOpen ? styles.chevronOpen : ''}`}
                aria-hidden="true"
              />
            </button>

            {menuOpen ? (
              <div className={styles.dropdown} role="menu" aria-label="Opções do usuário">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setMenuOpen(false);
                    setCreateTeamOpen(true);
                  }}
                >
                  <Plus className="icon icon-sm" aria-hidden="true" />
                  <span>Adicionar equipe</span>
                </button>

                <div className={styles.dropdownDivider} role="separator" />

                <button
                  type="button"
                  role="menuitem"
                  className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  onClick={() => {
                    setMenuOpen(false);
                    void auth.signOut();
                  }}
                >
                  <LogOut className="icon icon-sm" aria-hidden="true" />
                  <span>Sair</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <Outlet />

      <CreateTeamDialog
        open={createTeamOpen}
        onClose={() => setCreateTeamOpen(false)}
        onCreated={(createdTeamId) => {
          setCreateTeamOpen(false);
          void navigate(`/app/equipes/${createdTeamId}/links`);
        }}
      />
    </main>
  );
}
