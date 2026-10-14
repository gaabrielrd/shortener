import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Table,
  type TableColumn,
} from '@vitru/styleguide';
import { Archive, ArrowLeft, Clipboard, Power, RotateCcw, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnalyticsPanel } from '@/features/analytics';
import { useMembers, useTeams } from '@/features/teams';
import {
  historyActionLabel,
  statusLabel,
  validateDestinationUrl,
  type HistoryCursor,
  type LinkHistoryEntry,
  type LinkStatusCommand,
} from '../model/link';
import { useLinks } from './linksContext';
import styles from './LinkDetailPage.module.css';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

const ACTION_COPY: Record<
  LinkStatusCommand,
  { readonly title: string; readonly description: string; readonly confirm: string }
> = {
  disable: {
    title: 'Desativar link?',
    description: 'O endereço deixará de redirecionar até ser reativado.',
    confirm: 'Desativar',
  },
  archive: {
    title: 'Arquivar link?',
    description: 'O endereço será preservado e poderá ser restaurado depois.',
    confirm: 'Arquivar',
  },
  restore: {
    title: 'Restaurar link?',
    description: 'O mesmo endereço voltará ao estado ativo.',
    confirm: 'Restaurar',
  },
};

export function LinkDetailPage() {
  const teams = useTeams();
  const members = useMembers();
  const links = useLinks();
  const navigate = useNavigate();
  const { teamId, slug = '' } = useParams<{ teamId: string; slug: string }>();
  const requestedTeam = teams.teams.find((team) => team.id === teamId) ?? null;
  const link = links.links.find((item) => item.slug === slug) ?? null;
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [statusCommand, setStatusCommand] = useState<LinkStatusCommand | null>(null);
  const [history, setHistory] = useState<readonly LinkHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<HistoryCursor | null>(null);
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [historyRevision, setHistoryRevision] = useState(0);
  const selectTeam = teams.selectTeam;
  const loadHistoryPage = links.loadHistory;

  useEffect(() => {
    if (requestedTeam !== null && teams.activeTeam?.id !== requestedTeam.id) {
      selectTeam(requestedTeam.id);
    }
  }, [requestedTeam, selectTeam, teams.activeTeam?.id]);

  useEffect(() => {
    if (link === null) return;
    let active = true;
    void loadHistoryPage(link.slug)
      .then((page) => {
        if (!active) return;
        setHistory(page.entries);
        setCursor(page.nextCursor);
        setHistoryStatus('ready');
      })
      .catch(() => {
        if (active) setHistoryStatus('error');
      });
    return () => {
      active = false;
    };
  }, [historyRevision, link, loadHistoryPage]);

  if (teams.status === 'loading' || (requestedTeam !== null && teams.activeTeam?.id !== teamId)) {
    return <LoadingState label="Preparando o link..." />;
  }
  if (requestedTeam === null) {
    return (
      <ErrorState
        title="Link não disponível"
        description="Essa equipe não existe ou não faz parte das suas equipes."
        action={<Button onClick={() => void navigate('/app')}>Voltar às minhas equipes</Button>}
      />
    );
  }
  if (links.status === 'idle' || links.status === 'loading') {
    return <LoadingState label="Carregando detalhes do link..." />;
  }
  if (links.status === 'error' || link === null) {
    return (
      <ErrorState
        title="Link não disponível"
        description="O link não existe ou você não tem permissão para gerenciá-lo."
        action={
          <Button onClick={() => void navigate(`/app/equipes/${requestedTeam.id}/links`)}>
            Voltar aos links
          </Button>
        }
      />
    );
  }

  async function submitDestination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rawDestination = new FormData(event.currentTarget).get('destinationUrl');
    const submittedDestination = typeof rawDestination === 'string' ? rawDestination : '';
    const failure = validateDestinationUrl(submittedDestination);
    if (failure !== null) {
      setFieldError(failure.message);
      return;
    }
    setFieldError(null);
    const result = await links.updateDestination(slug, submittedDestination);
    if (!result.ok) return;
    links.clearDestinationDraft(slug);
    setFeedback(result.changed ? 'Destino atualizado.' : 'O destino já estava atualizado.');
    setHistoryRevision((value) => value + (result.changed ? 1 : 0));
  }

  async function confirmStatus() {
    if (statusCommand === null) return;
    const result = await links.changeStatus(slug, statusCommand);
    if (!result.ok) return;
    const copy = ACTION_COPY[statusCommand];
    setFeedback(result.changed ? `${copy.confirm} concluído.` : 'O link já estava nesse estado.');
    setStatusCommand(null);
    setHistoryRevision((value) => value + (result.changed ? 1 : 0));
  }

  async function loadMore() {
    if (cursor === null) return;
    setHistoryStatus('loading');
    try {
      const page = await links.loadHistory(slug, cursor);
      setHistory((current) => [...current, ...page.entries]);
      setCursor(page.nextCursor);
      setHistoryStatus('ready');
    } catch {
      setHistoryStatus('error');
    }
  }

  const historyColumns: readonly TableColumn<LinkHistoryEntry>[] = [
    { key: 'action', header: 'Alteração', cell: (entry) => historyActionLabel(entry.action) },
    {
      key: 'actor',
      header: 'Responsável',
      cell: (entry) =>
        members.members.find((member) => member.uid === entry.actorId)?.displayName ??
        'Membro da equipe',
    },
    { key: 'previous', header: 'Valor anterior', cell: (entry) => entry.previousValue ?? '—' },
    { key: 'next', header: 'Novo valor', cell: (entry) => entry.nextValue ?? '—' },
    { key: 'date', header: 'Data', cell: (entry) => formatDate(entry.createdAt) },
  ];

  return (
    <section className={styles.page}>
      <Link className={styles.backLink} to={`/app/equipes/${requestedTeam.id}/links`}>
        <ArrowLeft className="icon icon-sm" aria-hidden="true" />
        Voltar aos links
      </Link>
      <div className={styles.pageHeader}>
        <PageHeader
          title={`/${link.slug}`}
          description={links.publicUrl(link.slug)}
          actions={
            <div className={styles.headerActions}>
              <Badge variant={link.status === 'active' ? 'success' : 'neutral'}>
                {statusLabel(link.status)}
              </Badge>
              <Button
                variant="secondary"
                onClick={() => {
                  void links
                    .copy(links.publicUrl(link.slug))
                    .then((copied) =>
                      setCopyFeedback(
                        copied ? 'Endereço copiado.' : 'Não foi possível copiar automaticamente.',
                      ),
                    );
                }}
              >
                <Clipboard className="icon icon-sm" aria-hidden="true" />
                Copiar link
              </Button>
            </div>
          }
        />
      </div>
      {copyFeedback !== null ? <p role="status">{copyFeedback}</p> : null}

      {feedback !== null ? (
        <Alert variant="success" title="Link atualizado">
          {feedback}
        </Alert>
      ) : null}
      {links.error !== null ? (
        <Alert variant="danger" title="Não foi possível alterar o link">
          {links.error.message}
        </Alert>
      ) : null}

      <div className={styles.grid}>
        <Card title="Destino" tone="raised">
          <form
            className={styles.form}
            onSubmit={(event) => void submitDestination(event)}
            noValidate
          >
            <Input
              label="URL de destino"
              name="destinationUrl"
              type="url"
              value={links.destinationDraft(link.slug, link.destinationUrl)}
              error={fieldError ?? undefined}
              onChange={(event) => {
                links.setDestinationDraft(link.slug, event.target.value);
                setFieldError(null);
                setFeedback(null);
              }}
            />
            <Button type="submit" disabled={links.operatingSlug === link.slug}>
              <Save className="icon icon-sm" aria-hidden="true" />
              {links.operatingSlug === link.slug ? 'Salvando...' : 'Salvar destino'}
            </Button>
          </form>
        </Card>

        <AnalyticsPanel slug={link.slug} totalClicks={link.totalClicks} />
      </div>

      <Card title="Histórico de alterações">
        {historyStatus === 'loading' && history.length === 0 ? (
          <LoadingState label="Carregando histórico..." />
        ) : historyStatus === 'error' ? (
          <ErrorState
            title="Não foi possível carregar o histórico"
            action={
              <Button
                onClick={() => {
                  setHistoryStatus('loading');
                  setHistoryRevision((value) => value + 1);
                }}
              >
                Tentar novamente
              </Button>
            }
          />
        ) : history.length === 0 ? (
          <EmptyState title="Nenhuma alteração registrada" />
        ) : (
          <>
            <div className={styles.tableWrap}>
              <Table
                caption={`Histórico do link ${link.slug}`}
                columns={historyColumns}
                rows={history}
                rowKey={(entry) => entry.id}
              />
            </div>
            {cursor !== null ? (
              <Button
                type="button"
                variant="secondary"
                disabled={historyStatus === 'loading'}
                onClick={() => void loadMore()}
              >
                {historyStatus === 'loading' ? 'Carregando...' : 'Carregar mais'}
              </Button>
            ) : null}
          </>
        )}
      </Card>

      <Card title="Estado do link" tone="quiet">
        <div className={styles.statusActions}>
          {link.status === 'active' ? (
            <Button variant="secondary" onClick={() => setStatusCommand('disable')}>
              <Power className="icon icon-sm" aria-hidden="true" /> Desativar
            </Button>
          ) : null}
          {link.status === 'disabled' || link.status === 'archived' ? (
            <Button onClick={() => setStatusCommand('restore')}>
              <RotateCcw className="icon icon-sm" aria-hidden="true" />
              {link.status === 'archived' ? 'Restaurar' : 'Reativar'}
            </Button>
          ) : null}
          {link.status !== 'archived' ? (
            <Button variant="danger" onClick={() => setStatusCommand('archive')}>
              <Archive className="icon icon-sm" aria-hidden="true" /> Arquivar
            </Button>
          ) : null}
        </div>
        <p className={styles.note}>Arquivar nunca libera o endereço para outra pessoa.</p>
      </Card>

      <Dialog
        open={statusCommand !== null}
        title={statusCommand === null ? '' : ACTION_COPY[statusCommand].title}
        onClose={() => setStatusCommand(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusCommand(null)}>
              Cancelar
            </Button>
            <Button
              variant={statusCommand === 'archive' ? 'danger' : 'primary'}
              disabled={links.operatingSlug === link.slug}
              onClick={() => void confirmStatus()}
            >
              {statusCommand === null ? 'Confirmar' : ACTION_COPY[statusCommand].confirm}
            </Button>
          </>
        }
      >
        <p>{statusCommand === null ? '' : ACTION_COPY[statusCommand].description}</p>
      </Dialog>
    </section>
  );
}
