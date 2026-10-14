import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Table,
  type TableColumn,
} from '@vitru/styleguide';
import { LogOut, ShieldCheck, UserMinus, UserRoundCog } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '@/features/auth';
import type { TeamMember } from '../model/member';
import type { TeamRole } from '../model/team';
import { useMembers } from './membersContext';
import { useTeams } from './teamsContext';
import styles from './MembersPage.module.css';

type Confirmation =
  | { readonly kind: 'role'; readonly member: TeamMember; readonly role: TeamRole }
  | { readonly kind: 'remove'; readonly member: TeamMember }
  | { readonly kind: 'leave' }
  | null;

function confirmationCopy(confirmation: Exclude<Confirmation, null>): {
  readonly title: string;
  readonly body: ReactNode;
  readonly action: string;
} {
  if (confirmation.kind === 'leave') {
    return {
      title: 'Sair da equipe?',
      body: 'Você perderá acesso imediato aos dados desta equipe. Seus links permanecerão com ela.',
      action: 'Sair da equipe',
    };
  }
  if (confirmation.kind === 'remove') {
    return {
      title: `Remover ${confirmation.member.displayName}?`,
      body: 'A pessoa perderá acesso imediato. Os links que ela criou permanecerão com a equipe.',
      action: 'Remover membro',
    };
  }
  return {
    title: `Alterar o nível de ${confirmation.member.displayName}?`,
    body:
      confirmation.role === 'member'
        ? 'A pessoa deixará de administrar membros, convites e todos os links da equipe.'
        : 'A pessoa poderá administrar membros, convites e todos os links da equipe.',
    action: confirmation.role === 'admin' ? 'Promover' : 'Rebaixar',
  };
}

export function MembersPage() {
  const auth = useAuth();
  const teams = useTeams();
  const members = useMembers();
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const requestedTeam = teams.teams.find((team) => team.id === teamId) ?? null;
  const selectTeam = teams.selectTeam;

  useEffect(() => {
    if (requestedTeam !== null && teams.activeTeam?.id !== requestedTeam.id) {
      selectTeam(requestedTeam.id);
    }
  }, [requestedTeam, selectTeam, teams.activeTeam?.id]);

  if (teams.status === 'loading' || (requestedTeam !== null && teams.activeTeam?.id !== teamId)) {
    return <LoadingState label="Preparando os membros da equipe..." />;
  }
  if (requestedTeam === null) {
    return (
      <ErrorState
        title="Equipe não disponível"
        description="Esse espaço não existe ou não faz parte das suas equipes."
        action={<Button onClick={() => void navigate('/app')}>Voltar às minhas equipes</Button>}
      />
    );
  }
  if (members.status === 'error' && members.error?.code === 'members/forbidden') {
    return (
      <ErrorState
        title="Equipe não disponível"
        description="Seu acesso a este espaço foi removido ou não está mais disponível."
        action={<Button onClick={() => void navigate('/app')}>Voltar às minhas equipes</Button>}
      />
    );
  }

  async function confirmAction() {
    if (confirmation === null) return;
    const result =
      confirmation.kind === 'leave'
        ? await members.leaveTeam()
        : confirmation.kind === 'remove'
          ? await members.removeMember(confirmation.member.uid)
          : await members.changeRole(confirmation.member.uid, confirmation.role);
    if (result.ok) {
      setConfirmation(null);
      if (confirmation.kind === 'leave') void navigate('/app');
    }
  }

  const isAdministrator = requestedTeam.role === 'admin';
  const columns: readonly TableColumn<TeamMember>[] = [
    {
      key: 'person',
      header: 'Pessoa',
      cell: (member) => (
        <span className={styles.person}>
          <strong>{member.displayName}</strong>
          <small>{member.email}</small>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Nível',
      cell: (member) => (
        <Badge variant={member.role === 'admin' ? 'accent' : 'neutral'}>
          {member.role === 'admin' ? 'Administrador' : 'Membro'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'end',
      cell: (member) => {
        if (!isAdministrator)
          return <span className={styles.noAction}>Sem ações administrativas</span>;
        return (
          <span className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              disabled={members.operatingUid !== null}
              onClick={() =>
                setConfirmation({
                  kind: 'role',
                  member,
                  role: member.role === 'admin' ? 'member' : 'admin',
                })
              }
            >
              <UserRoundCog className="icon icon-sm" aria-hidden="true" />
              {member.role === 'admin' ? 'Rebaixar' : 'Promover'}
            </Button>
            {member.uid !== auth.user?.uid ? (
              <Button
                type="button"
                variant="danger"
                disabled={members.operatingUid !== null}
                onClick={() => setConfirmation({ kind: 'remove', member })}
              >
                <UserMinus className="icon icon-sm" aria-hidden="true" />
                Remover
              </Button>
            ) : null}
          </span>
        );
      },
    },
  ];

  const copy = confirmation === null ? null : confirmationCopy(confirmation);

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <PageHeader
          title="Membros"
          description={
            isAdministrator
              ? 'Gerencie as pessoas e os níveis de acesso da equipe.'
              : 'Pessoas que participam desta equipe.'
          }
          actions={
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmation({ kind: 'leave' })}
            >
              <LogOut className="icon icon-sm" aria-hidden="true" />
              Sair da equipe
            </Button>
          }
        />
      </div>

      {members.feedback !== null ? (
        <Alert variant="success" title="Alteração concluída">
          {members.feedback}
        </Alert>
      ) : null}
      {members.error !== null && members.status !== 'error' ? (
        <Alert variant="danger" title="Não foi possível alterar o membro">
          {members.error.message}
        </Alert>
      ) : null}

      {members.status === 'idle' || members.status === 'loading' ? (
        <LoadingState label="Carregando membros..." />
      ) : members.status === 'error' ? (
        <ErrorState
          title="Não foi possível carregar os membros"
          description={members.error?.message}
          action={<Button onClick={members.retry}>Tentar novamente</Button>}
        />
      ) : members.status === 'empty' ? (
        <EmptyState
          title="Nenhum membro disponível"
          description="Atualize a página ou volte às suas equipes."
        />
      ) : (
        <div className={styles.tableWrap}>
          <Table
            caption={`Membros autorizados da equipe ${requestedTeam.name}`}
            columns={columns}
            rows={members.members}
            rowKey={(member) => member.uid}
          />
        </div>
      )}

      {isAdministrator ? (
        <Alert variant="info" title="Continuidade administrativa">
          <ShieldCheck className="icon icon-sm" aria-hidden="true" /> O último administrador não
          pode sair, ser removido nem rebaixado.
        </Alert>
      ) : null}

      <Dialog
        open={confirmation !== null}
        title={copy?.title ?? 'Confirmar alteração'}
        onClose={() => setConfirmation(null)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirmation(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={members.operatingUid !== null}
              onClick={() => void confirmAction()}
            >
              {members.operatingUid !== null ? 'Aplicando...' : (copy?.action ?? 'Confirmar')}
            </Button>
          </>
        }
      >
        <p>{copy?.body}</p>
      </Dialog>
    </section>
  );
}
