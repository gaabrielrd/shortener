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
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

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
        menuTriggerRef.current?.focus();
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const items = [
          ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
        ];
        const index = items.findIndex((item) => item === document.activeElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : event.key === 'ArrowDown'
                ? (index + 1) % items.length
                : index < 0
                  ? items.length - 1
                  : (index - 1 + items.length) % items.length;
        items[next]?.focus();
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
    <div className={styles.app}>
      <a className={styles.skipLink} href="#workspace-content">
        Ir para o conteúdo
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/app" className={styles.brand} aria-label="Ir para o início do Short Links">
            <img className={styles.mark} src="/favicon.svg" alt="" width="28" height="28" />
            <h1>{PROJECT_NAME}</h1>
          </Link>

          {auth.user ? (
            <div
              className={styles.userMenuContainer}
              ref={menuRef}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
              }}
            >
              <button
                ref={menuTriggerRef}
                type="button"
                className={styles.userMenuTrigger}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label={`Menu de ${auth.user.displayName}`}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {auth.user.displayName.slice(0, 1).toLocaleUpperCase('pt-BR')}
                </span>
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
        </div>
      </header>

      <main id="workspace-content" className={styles.content} tabIndex={-1}>
        <Outlet />
      </main>

      <CreateTeamDialog
        open={createTeamOpen}
        onClose={() => setCreateTeamOpen(false)}
        onCreated={(createdTeamId) => {
          setCreateTeamOpen(false);
          void navigate(`/app/equipes/${createdTeamId}/links`);
        }}
      />
    </div>
  );
}
