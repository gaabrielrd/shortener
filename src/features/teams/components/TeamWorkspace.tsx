import { useEffect } from 'react';
import { Badge, Button, ErrorState, LoadingState, Select } from '@vitru/styleguide';
import { Link2, UserPlus, Users } from 'lucide-react';
import { Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { useTeams } from './teamsContext';
import styles from './TeamWorkspace.module.css';

export function TeamWorkspace() {
  const teams = useTeams();
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const requestedTeam = teams.teams.find((team) => team.id === teamId) ?? null;
  const selectTeam = teams.selectTeam;

  useEffect(() => {
    if (requestedTeam !== null && teams.activeTeam?.id !== requestedTeam.id) {
      selectTeam(requestedTeam.id);
    }
  }, [requestedTeam, selectTeam, teams.activeTeam?.id]);

  if (teams.status === 'idle' || teams.status === 'loading') {
    return <LoadingState label="Preparando a equipe ativa..." />;
  }
  if (teams.status === 'error') {
    return (
      <ErrorState
        title="Não foi possível carregar suas equipes"
        description={teams.error?.message}
        action={<Button onClick={teams.retry}>Tentar novamente</Button>}
      />
    );
  }
  if (teams.status === 'empty') return <Navigate to="/app" replace />;
  if (requestedTeam === null) {
    return (
      <ErrorState
        title="Equipe não disponível"
        description="Esse espaço não existe ou não faz parte das suas equipes."
        action={<Button onClick={() => void navigate('/app')}>Voltar às minhas equipes</Button>}
      />
    );
  }
  if (teams.activeTeam?.id !== requestedTeam.id) {
    return <LoadingState label="Preparando a equipe ativa..." />;
  }

  return (
    <section className={styles.workspace}>
      <div className={styles.workspaceHeader}>
        <div className={styles.identity}>
          <p className={styles.eyebrow}>Espaço de trabalho</p>
          <div className={styles.teamName}>
            <h2>{requestedTeam.name}</h2>
            <Badge variant="neutral">
              {requestedTeam.role === 'admin' ? 'Administrador' : 'Membro'}
            </Badge>
          </div>
        </div>
        <div className={styles.contextBar}>
          <Select
            label="Equipe ativa"
            value={requestedTeam.id}
            options={teams.teams.map((team) => ({ value: team.id, label: team.name }))}
            onChange={(event) => {
              const nextTeamId = event.target.value;
              if (teams.selectTeam(nextTeamId)) {
                void navigate(`/app/equipes/${nextTeamId}/links`);
              }
            }}
          />
        </div>
      </div>

      <nav className={styles.tabs} aria-label="Seções da equipe">
        <NavLink
          className={({ isActive }) => (isActive ? styles.activeTab : styles.tab)}
          to="links"
        >
          <Link2 className="icon icon-sm" aria-hidden="true" />
          Links
        </NavLink>
        <NavLink
          className={({ isActive }) => (isActive ? styles.activeTab : styles.tab)}
          to="membros"
        >
          <Users className="icon icon-sm" aria-hidden="true" />
          Membros
        </NavLink>
        {requestedTeam.role === 'admin' ? (
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeTab : styles.tab)}
            to="convites"
          >
            <UserPlus className="icon icon-sm" aria-hidden="true" />
            Convites
          </NavLink>
        ) : null}
      </nav>

      <div className={styles.content}>
        <Outlet key={requestedTeam.id} />
      </div>
    </section>
  );
}
