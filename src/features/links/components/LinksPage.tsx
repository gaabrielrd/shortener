import { useEffect, useState, type FormEvent } from 'react';
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
  Table,
  type TableColumn,
} from '@vitru/styleguide';
import { ArrowLeft, Clipboard, ExternalLink, Link2, Plus, Settings } from 'lucide-react';
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
    setSlug('');
    setDestinationUrl('');
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
      cell: (item) => <strong className={styles.slug}>/{item.slug}</strong>,
    },
    {
      key: 'destination',
      header: 'Destino',
      cell: (item) => (
        <a
          className={styles.destination}
          href={item.destinationUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span>{item.destinationUrl}</span>
          <ExternalLink className="icon icon-sm" aria-hidden="true" />
        </a>
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
        <Badge variant={item.status === 'active' ? 'accent' : 'neutral'}>
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
      <PageHeader
        title={`Links de ${requestedTeam.name}`}
        description={
          requestedTeam.role === 'admin'
            ? 'Você vê todos os links desta equipe.'
            : 'Você vê apenas os links criados por você.'
        }
      />
      <Link className={styles.backLink} to={`/app/equipes/${requestedTeam.id}`}>
        <ArrowLeft className="icon icon-sm" aria-hidden="true" />
        Voltar ao dashboard
      </Link>

      <Card title="Novo link curto" tone="raised">
        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <Input
            label="Endereço curto"
            hint="De 3 a 50 letras, números ou hífens. O endereço não poderá ser reutilizado."
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
          <Input
            label="URL de destino"
            hint="Aceita endereços absolutos iniciados por http:// ou https://."
            name="destinationUrl"
            type="url"
            value={destinationUrl}
            error={failure?.field === 'destinationUrl' ? failure.message : undefined}
            onChange={(event) => {
              setDestinationUrl(event.target.value);
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
          <Button type="submit" disabled={links.isCreating}>
            <Plus className="icon icon-sm" aria-hidden="true" />
            {links.isCreating ? 'Criando link...' : 'Criar link'}
          </Button>
        </form>
      </Card>

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
