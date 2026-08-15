import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from '@vitru/styleguide';
import { Link2, Plus, UserPlus, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { validateTeamName } from '../model/team';
import type { TeamFailure } from '../model/team';
import { useTeams } from './teamsContext';
import styles from './TeamsPage.module.css';

function CreateTeamForm({ onCreated }: { readonly onCreated: (teamId: string) => void }) {
  const teams = useTeams();
  const [name, setName] = useState('');
  const [failure, setFailure] = useState<TeamFailure | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationFailure = validateTeamName(name);
    if (validationFailure !== null) {
      setFailure(validationFailure);
      return;
    }

    setFailure(null);
    const result = await teams.createTeam(name);
    if (!result.ok) {
      setFailure(result.failure);
      return;
    }

    setName('');
    onCreated(result.team.id);
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <Input
        label="Nome da nova equipe"
        hint="Use um nome reconhecível para as pessoas que trabalham juntas."
        name="teamName"
        value={name}
        maxLength={80}
        autoComplete="organization"
        error={failure?.field === 'name' ? failure.message : undefined}
        onChange={(event) => {
          setName(event.target.value);
          if (failure !== null) setFailure(null);
        }}
      />
      {failure !== null && failure.field !== 'name' ? (
        <Alert variant="danger" title="Não foi possível criar a equipe">
          {failure.message}
        </Alert>
      ) : null}
      <Button type="submit" disabled={teams.isCreating}>
        <Plus className="icon icon-sm" aria-hidden="true" />
        {teams.isCreating ? 'Criando equipe...' : 'Criar equipe'}
      </Button>
    </form>
  );
}

export function TeamsPage() {
  const teams = useTeams();
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const selectTeam = teams.selectTeam;

  const requestedTeam =
    teamId === undefined
      ? teams.activeTeam
      : (teams.teams.find((team) => team.id === teamId) ?? null);

  useEffect(() => {
    if (teamId !== undefined && requestedTeam !== null && teams.activeTeam?.id !== teamId) {
      selectTeam(teamId);
    }
  }, [requestedTeam, selectTeam, teamId, teams.activeTeam?.id]);

  if (teams.status === 'idle' || teams.status === 'loading') {
    return <LoadingState label="Carregando suas equipes..." />;
  }

  if (teams.status === 'error') {
    return (
      <ErrorState
        title="Não foi possível carregar suas equipes"
        description={teams.error?.message}
        action={
          <Button type="button" onClick={teams.retry}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  if (teams.status === 'empty') {
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
          <CreateTeamForm onCreated={(id) => void navigate(`/app/equipes/${id}`)} />
        </Card>
      </section>
    );
  }

  if (teamId !== undefined && requestedTeam === null) {
    return (
      <ErrorState
        title="Equipe não disponível"
        description="Esse espaço não existe ou não faz parte das suas equipes."
        action={
          <Button type="button" onClick={() => void navigate('/app')}>
            Voltar às minhas equipes
          </Button>
        }
      />
    );
  }

  const activeTeam = requestedTeam ?? teams.activeTeam;
  if (activeTeam === null) return <LoadingState label="Preparando a equipe ativa..." />;

  return (
    <section className={styles.page}>
      <PageHeader
        title={activeTeam.name}
        description="Este é o contexto ativo. Links, membros e analytics acompanharão esta seleção."
        actions={
          <Badge variant={activeTeam.role === 'admin' ? 'accent' : 'neutral'}>
            {activeTeam.role === 'admin' ? 'Administrador' : 'Membro'}
          </Badge>
        }
      />

      <div className={styles.contextBar}>
        <Select
          label="Equipe ativa"
          value={activeTeam.id}
          options={teams.teams.map((team) => ({ value: team.id, label: team.name }))}
          onChange={(event) => {
            const nextTeamId = event.target.value;
            if (teams.selectTeam(nextTeamId)) void navigate(`/app/equipes/${nextTeamId}`);
          }}
        />
      </div>

      <div className={styles.teamLinks}>
        <Link className={styles.membersLink} to={`/app/equipes/${activeTeam.id}/links`}>
          <Link2 className="icon icon-sm" aria-hidden="true" />
          Gerenciar links
        </Link>
        <Link className={styles.membersLink} to={`/app/equipes/${activeTeam.id}/membros`}>
          <Users className="icon icon-sm" aria-hidden="true" />
          {activeTeam.role === 'admin' ? 'Gerenciar membros' : 'Ver membros'}
        </Link>
        {activeTeam.role === 'admin' ? (
          <Link className={styles.membersLink} to={`/app/equipes/${activeTeam.id}/convites`}>
            <UserPlus className="icon icon-sm" aria-hidden="true" />
            Gerenciar convites
          </Link>
        ) : null}
      </div>

      <div className={styles.grid}>
        <Card title="Links curtos" tone="raised">
          <div className={styles.confirmation}>
            <Link2 className="icon" aria-hidden="true" />
            <div>
              <strong>Crie endereços fáceis de lembrar</strong>
              <p>Personalize o slug e acompanhe os links permitidos para o seu nível de acesso.</p>
            </div>
          </div>
        </Card>

        <Card title="Nova equipe" tone="quiet">
          <div className={styles.supportingCopy}>
            <Users className="icon" aria-hidden="true" />
            <p>Você pode criar outros espaços e alternar entre eles a qualquer momento.</p>
          </div>
          <CreateTeamForm onCreated={(id) => void navigate(`/app/equipes/${id}`)} />
        </Card>
      </div>
    </section>
  );
}
