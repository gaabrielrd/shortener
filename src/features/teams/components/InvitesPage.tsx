import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Table,
  type TableColumn,
} from '@vitru/styleguide';
import { Ban, Clipboard, Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { getClientInviteStatus, validateInviteExpiration, type TeamInvite } from '../model/invite';
import { useInvites } from './invitesContext';
import { useTeams } from './teamsContext';
import styles from './InvitesPage.module.css';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function InvitesPage() {
  const teams = useTeams();
  const invites = useInvites();
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const requestedTeam = teams.teams.find((team) => team.id === teamId) ?? null;
  const [expiresAt, setExpiresAt] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TeamInvite | null>(null);
  const selectTeam = teams.selectTeam;

  useEffect(() => {
    if (requestedTeam !== null && teams.activeTeam?.id !== requestedTeam.id)
      selectTeam(requestedTeam.id);
  }, [requestedTeam, selectTeam, teams.activeTeam?.id]);

  if (teams.status === 'loading' || (requestedTeam !== null && teams.activeTeam?.id !== teamId)) {
    return <LoadingState label="Preparando os convites da equipe..." />;
  }
  if (requestedTeam === null || requestedTeam.role !== 'admin') {
    return (
      <ErrorState
        title="Convites não disponíveis"
        description="Somente administradores desta equipe acessam os convites."
        action={<Button onClick={() => void navigate('/app')}>Voltar às minhas equipes</Button>}
      />
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const failure = validateInviteExpiration(expiresAt);
    if (failure !== null) {
      setFieldError(failure.message);
      return;
    }
    const result = await invites.create(new Date(expiresAt).toISOString());
    if (!result.ok) {
      if (result.failure.field === 'expiresAt') setFieldError(result.failure.message);
      return;
    }
    setCreatedLink(`${window.location.origin}/invite/${result.token}`);
    setCopyFeedback(null);
    setExpiresAt('');
  }

  const columns: readonly TableColumn<TeamInvite>[] = [
    { key: 'created', header: 'Criado em', cell: (invite) => formatDate(invite.createdAt) },
    { key: 'expires', header: 'Validade', cell: (invite) => formatDate(invite.expiresAt) },
    {
      key: 'status',
      header: 'Estado',
      cell: (invite) => {
        const status = getClientInviteStatus(invite);
        return (
          <Badge variant={status === 'active' ? 'success' : 'neutral'}>
            {status === 'active' ? 'Ativo' : status === 'expired' ? 'Vencido' : 'Cancelado'}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'end',
      cell: (invite) =>
        getClientInviteStatus(invite) === 'active' ? (
          <span className={styles.actions}>
            <Button
              type="button"
              variant="danger"
              disabled={invites.cancelingId !== null}
              onClick={() => setCancelTarget(invite)}
            >
              <Ban className="icon icon-sm" aria-hidden="true" /> Cancelar
            </Button>
          </span>
        ) : (
          'Sem ações'
        ),
    },
  ];

  return (
    <section className={styles.page}>
      <PageHeader
        title="Convites"
        description="Crie um convite reutilizável para adicionar pessoas à equipe."
      />
      <Alert variant="info" title="Compartilhe com cuidado">
        Qualquer pessoa com o link e uma conta Google poderá entrar na equipe enquanto o convite
        estiver ativo.
      </Alert>

      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <Input
          label="Validade do convite"
          name="expiresAt"
          type="datetime-local"
          value={expiresAt}
          error={fieldError ?? undefined}
          onChange={(event) => {
            setExpiresAt(event.target.value);
            setFieldError(null);
          }}
        />
        <Button type="submit" disabled={invites.isCreating}>
          <Plus className="icon icon-sm" aria-hidden="true" />
          {invites.isCreating ? 'Criando convite...' : 'Criar convite'}
        </Button>
      </form>

      {createdLink !== null ? (
        <Alert variant="success" title="Convite criado">
          <div className={styles.created}>
            <p>Copie agora: por segurança, o endereço completo não poderá ser recuperado depois.</p>
            <div className={styles.copyRow}>
              <div className={styles.copyField}>
                <Input label="Link do convite" value={createdLink} readOnly />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  void invites
                    .copy(createdLink)
                    .then((copied) =>
                      setCopyFeedback(
                        copied ? 'Link copiado.' : 'Não foi possível copiar automaticamente.',
                      ),
                    )
                }
              >
                <Clipboard className="icon icon-sm" aria-hidden="true" />
                Copiar link
              </Button>
            </div>
            {copyFeedback !== null ? <p role="status">{copyFeedback}</p> : null}
          </div>
        </Alert>
      ) : null}

      {invites.error !== null && invites.status !== 'error' ? (
        <Alert variant="danger" title="Não foi possível alterar o convite">
          {invites.error.message}
        </Alert>
      ) : null}
      {invites.status === 'idle' || invites.status === 'loading' ? (
        <LoadingState label="Carregando convites..." />
      ) : invites.status === 'error' ? (
        <ErrorState
          title="Não foi possível carregar os convites"
          description={invites.error?.message}
          action={<Button onClick={() => invites.retry()}>Tentar novamente</Button>}
        />
      ) : invites.status === 'empty' ? (
        <EmptyState
          title="Nenhum convite criado"
          description="Escolha uma validade futura para criar o primeiro convite reutilizável."
        />
      ) : (
        <div className={styles.tableWrap}>
          <Table
            caption={`Convites da equipe ${requestedTeam.name}`}
            columns={columns}
            rows={invites.invites}
            rowKey={(invite) => invite.id}
          />
        </div>
      )}

      <Dialog
        open={cancelTarget !== null}
        title="Cancelar convite?"
        onClose={() => setCancelTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Manter ativo
            </Button>
            <Button
              variant="danger"
              disabled={invites.cancelingId !== null}
              onClick={() => {
                if (cancelTarget !== null)
                  void invites.cancel(cancelTarget.id).then((result) => {
                    if (result.ok) setCancelTarget(null);
                  });
              }}
            >
              <Ban className="icon icon-sm" aria-hidden="true" />
              {invites.cancelingId !== null ? 'Cancelando...' : 'Cancelar convite'}
            </Button>
          </>
        }
      >
        <p>Novas entradas serão bloqueadas. Pessoas que já entraram continuarão na equipe.</p>
      </Dialog>
    </section>
  );
}
