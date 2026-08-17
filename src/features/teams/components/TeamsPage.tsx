import { useState } from 'react';
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@vitru/styleguide';
import { Plus } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router';
import { CreateTeamDialog } from './CreateTeamDialog';
import { useTeams } from './teamsContext';
import styles from './TeamsPage.module.css';

export function TeamsPage() {
  const teams = useTeams();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  if (teams.status === 'idle' || teams.status === 'loading') {
    return <LoadingState label="Carregando suas equipes..." />;
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
  if (teams.status !== 'empty' && teams.activeTeam !== null) {
    return <Navigate to={`/app/equipes/${teams.activeTeam.id}/links`} replace />;
  }

  return (
    <section className={styles.page}>
      <PageHeader
        title="Crie seu primeiro espaço de trabalho"
        description="Uma equipe reúne as pessoas e os links que vocês administram juntas."
      />
      <Card tone="raised">
        <EmptyState
          title="Você ainda não participa de uma equipe"
          description="Comece criando a equipe que vai publicar os primeiros links curtos."
        />
        <div className={styles.action}>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="icon icon-sm" aria-hidden="true" />
            Criar primeira equipe
          </Button>
        </div>
      </Card>

      <CreateTeamDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(teamId) => {
          setCreateOpen(false);
          void navigate(`/app/equipes/${teamId}/links`);
        }}
      />
    </section>
  );
}
