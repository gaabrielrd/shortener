import { useEffect, useState } from 'react';
import { Badge, Button, ErrorState, LoadingState, PageHeader, Select } from '@vitru/styleguide';
import { Link2, Plus, UserPlus, Users } from 'lucide-react';
import { Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { CreateTeamDialog } from './CreateTeamDialog';
import { useTeams } from './teamsContext';
import styles from './TeamWorkspace.module.css';

export function TeamWorkspace() {
  const teams = useTeams();
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const [createOpen, setCreateOpen] = useState(false);
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
      <PageHeader
        title={requestedTeam.name}
        description="Gerencie os links e o acesso das pessoas neste espaço de trabalho."
        actions={
          <div className={styles.headerActions}>
            <Badge variant={requestedTeam.role === 'admin' ? 'accent' : 'neutral'}>
              {requestedTeam.role === 'admin' ? 'Administrador' : 'Membro'}
            </Badge>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="icon icon-sm" aria-hidden="true" />
              Nova equipe
            </Button>
          </div>
        }
      />

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
        <Outlet />
      </div>

      <CreateTeamDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(createdTeamId) => {
          setCreateOpen(false);
          void navigate(`/app/equipes/${createdTeamId}/links`);
        }}
      />
    </section>
  );
}
