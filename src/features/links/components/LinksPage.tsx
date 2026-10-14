import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
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
  Select,
  Table,
  type TableColumn,
} from '@vitru/styleguide';
import { Clipboard, ExternalLink, Link2, Plus, Settings } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMembers, useTeams } from '@/features/teams';
import {
  normalizeSlug,
  statusLabel,
  validateDestinationUrl,
  validateSlug,
  type LinkFailure,
  type ShortLink,
} from '../model/link';
import { useLinks } from './linksContext';
import styles from './LinksPage.module.css';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function LinksPage() {
  const teams = useTeams();
  const members = useMembers();
  const links = useLinks();
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const requestedTeam = teams.teams.find((team) => team.id === teamId) ?? null;
  const [createOpen, setCreateOpen] = useState(false);
  const createTriggerId = useId();
  const formId = `${createTriggerId}-form`;
  const restoreFocusRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [slug, setSlug] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [failure, setFailure] = useState<LinkFailure | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const selectTeam = teams.selectTeam;

  useEffect(() => {
    if (requestedTeam !== null && teams.activeTeam?.id !== requestedTeam.id) {
      selectTeam(requestedTeam.id);
    }
  }, [requestedTeam, selectTeam, teams.activeTeam?.id]);

  useEffect(() => {
    if (!createOpen && !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      if (createOpen) formRef.current?.querySelector('input')?.focus();
      else document.getElementById(createTriggerId)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [createOpen, createTriggerId]);

  function closeCreateDialog() {
    if (links.isCreating) return;
    restoreFocusRef.current = true;
    setCreateOpen(false);
    setSlug('');
    setDestinationUrl('');
    setFailure(null);
  }

  if (teams.status === 'loading' || (requestedTeam !== null && teams.activeTeam?.id !== teamId)) {
    return <LoadingState label="Preparando os links da equipe..." />;
  }
  if (requestedTeam === null) {
    return (
      <ErrorState
        title="Links não disponíveis"
        description="Essa equipe não existe ou não faz parte das suas equipes."
        action={<Button onClick={() => void navigate('/app')}>Voltar às minhas equipes</Button>}
      />
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (links.isCreating) return;
    const slugFailure = validateSlug(slug);
    if (slugFailure !== null) {
      setFailure(slugFailure);
      return;
    }
    const destinationFailure = validateDestinationUrl(destinationUrl);
    if (destinationFailure !== null) {
      setFailure(destinationFailure);
      return;
    }
    setFailure(null);
    const result = await links.create(slug, destinationUrl);
    if (!result.ok) {
      setFailure(result.failure);
      return;
    }
    setCreatedSlug(result.link.slug);
    closeCreateDialog();
    setCopyFeedback(null);
  }

  function creatorName(uid: string): string {
    return members.members.find((member) => member.uid === uid)?.displayName ?? 'Membro da equipe';
  }

  function copyLink(linkSlug: string) {
    const publicUrl = links.publicUrl(linkSlug);
    void links.copy(publicUrl).then((copied) => {
      setCopyFeedback(
        copied ? `Link ${publicUrl} copiado.` : 'Não foi possível copiar automaticamente.',
      );
    });
  }

  const columns: readonly TableColumn<ShortLink>[] = [
    {
      key: 'short',
      header: 'Link curto',
      cell: (item) => (
        <div className={styles.linkIdentity}>
          <Link className={styles.slug} to={`/app/equipes/${requestedTeam.id}/links/${item.slug}`}>
            /{item.slug}
          </Link>
          <a
            className={styles.destination}
            href={item.destinationUrl}
            title={item.destinationUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span>{item.destinationUrl}</span>
            <ExternalLink className="icon icon-sm" aria-hidden="true" />
          </a>
        </div>
      ),
    },
    {
      key: 'creator',
      header: 'Criador',
      cell: (item) => creatorName(item.createdBy),
    },
    {
      key: 'created',
      header: 'Criado em',
      cell: (item) => formatDate(item.createdAt),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (item) => (
        <Badge variant={item.status === 'active' ? 'success' : 'neutral'}>
          {statusLabel(item.status)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'end',
      cell: (item) => (
        <span className={styles.actions}>
          <Button type="button" variant="secondary" onClick={() => copyLink(item.slug)}>
            <Clipboard className="icon icon-sm" aria-hidden="true" />
            Copiar
          </Button>
          <Link
            className={styles.manageLink}
            to={`/app/equipes/${requestedTeam.id}/links/${item.slug}`}
          >
            <Settings className="icon icon-sm" aria-hidden="true" />
            Gerenciar
          </Link>
        </span>
      ),
    },
  ];

  const createdUrl = createdSlug === null ? null : links.publicUrl(createdSlug);
  const filteredLinks =
    statusFilter === 'all'
      ? links.links
      : links.links.filter((item) => item.status === statusFilter);

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <PageHeader
          title="Links"
          description={
            requestedTeam.role === 'admin'
              ? 'Você vê todos os links desta equipe.'
              : 'Você vê apenas os links criados por você.'
          }
          actions={
            <Button
              id={createTriggerId}
              onClick={() => {
                setCreatedSlug(null);
                setCopyFeedback(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="icon icon-sm" aria-hidden="true" />
              Novo link
            </Button>
          }
        />
      </div>
      {createOpen ? (
        <Dialog
          open
          title="Novo link curto"
          onClose={closeCreateDialog}
          footer={
            <>
              <Button variant="secondary" disabled={links.isCreating} onClick={closeCreateDialog}>
                Cancelar
              </Button>
              <Button type="submit" form={formId} disabled={links.isCreating}>
                <Plus className="icon icon-sm" aria-hidden="true" />
                {links.isCreating ? 'Criando link...' : 'Criar link'}
              </Button>
            </>
          }
        >
          <form
            ref={formRef}
            id={formId}
            className={styles.form}
            onSubmit={(event) => void submit(event)}
            aria-busy={links.isCreating}
            noValidate
          >
            <Input
              label="URL de destino"
              hint="Aceita endereços absolutos iniciados por http:// ou https://."
              disabled={links.isCreating}
              name="destinationUrl"
              type="url"
              value={destinationUrl}
              error={failure?.field === 'destinationUrl' ? failure.message : undefined}
              onChange={(event) => {
                setDestinationUrl(event.target.value);
                setFailure(null);
              }}
            />
            <Input
              label="Endereço curto"
              hint="De 3 a 50 letras, números ou hífens. O endereço não poderá ser reutilizado."
              disabled={links.isCreating}
              name="slug"
              value={slug}
              maxLength={50}
              autoComplete="off"
              error={failure?.field === 'slug' ? failure.message : undefined}
              onChange={(event) => {
                setSlug(event.target.value);
                setFailure(null);
              }}
            />
            {slug.trim().length > 0 ? (
              <p className={styles.preview}>Prévia: {links.publicUrl(normalizeSlug(slug))}</p>
            ) : null}
            {failure !== null && failure.field === undefined ? (
              <Alert variant="danger" title="Não foi possível criar o link">
                {failure.message}
              </Alert>
            ) : null}
          </form>
        </Dialog>
      ) : null}

      {createdUrl !== null ? (
        <div className={styles.createdResult}>
          <Alert variant="success" title="Link criado">
            O endereço já está disponível para cópia.
          </Alert>
          <div className={styles.created}>
            <Link2 className="icon" aria-hidden="true" />
            <strong>{createdUrl}</strong>
            <Button type="button" variant="secondary" onClick={() => copyLink(createdSlug ?? '')}>
              <Clipboard className="icon icon-sm" aria-hidden="true" />
              Copiar link
            </Button>
          </div>
        </div>
      ) : null}

      {copyFeedback !== null ? <p role="status">{copyFeedback}</p> : null}
      {links.error !== null && links.status !== 'error' && failure === null ? (
        <Alert variant="danger" title="Não foi possível alterar os links">
          {links.error.message}
        </Alert>
      ) : null}
      {links.status === 'ready' ? (
        <div className={styles.toolbar}>
          <div className={styles.filter}>
            <Select
              label="Filtrar por estado"
              value={statusFilter}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'active', label: 'Ativos' },
                { value: 'disabled', label: 'Desativados' },
                { value: 'archived', label: 'Arquivados' },
              ]}
              onChange={(event) => setStatusFilter(event.target.value)}
            />
          </div>
          <p className={styles.count}>
            {filteredLinks.length} {filteredLinks.length === 1 ? 'link' : 'links'}
          </p>
        </div>
      ) : null}
      {links.status === 'idle' || links.status === 'loading' ? (
        <LoadingState label="Carregando links..." />
      ) : links.status === 'error' ? (
        <ErrorState
          title="Não foi possível carregar os links"
          description={links.error?.message}
          action={<Button onClick={links.retry}>Tentar novamente</Button>}
        />
      ) : links.status === 'empty' ? (
        <EmptyState
          title="Nenhum link disponível"
          description="Crie um endereço curto personalizado para começar."
        />
      ) : filteredLinks.length === 0 ? (
        <EmptyState
          title="Nenhum link neste estado"
          description="Altere o filtro para consultar outros links da equipe."
        />
      ) : (
        <div className={styles.tableWrap}>
          <Table
            caption={`Links da equipe ${requestedTeam.name}`}
            columns={columns}
            rows={filteredLinks}
            rowKey={(item) => item.slug}
          />
        </div>
      )}
    </section>
  );
}
