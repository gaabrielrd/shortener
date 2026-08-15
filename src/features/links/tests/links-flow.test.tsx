import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '@/app/routes';
import { AnalyticsProvider, type AnalyticsService } from '@/features/analytics';
import { AuthProvider, type AuthService } from '@/features/auth';
import { LinksProvider } from '@/features/links';
import {
  MembersProvider,
  TeamsProvider,
  type MembersService,
  type Team,
  type TeamsService,
} from '@/features/teams';
import { CREATED_LINK, createFakeLinksService } from './fakeLinksService';

const authService: AuthService = {
  subscribe(onUser) {
    onUser({ uid: 'user-1', displayName: 'Ana', email: 'ana@example.test' });
    return () => undefined;
  },
  ensureProfile: () => Promise.resolve(),
  startGoogleSignIn: () => Promise.resolve(null),
  signOut: () => Promise.resolve(null),
  takeReturnPath: () => null,
};

function renderLinks(role: Team['role'] = 'admin', path = '/app/equipes/team-1/links') {
  const team: Team = { id: 'team-1', name: 'Comunicação', role };
  const teamsService: TeamsService = {
    subscribe(_uid, onTeams) {
      onTeams([team]);
      return () => undefined;
    },
    createTeam: () => Promise.resolve({ ok: true, team }),
  };
  const membersService: MembersService = {
    subscribe(_teamId, onMembers) {
      onMembers([
        { uid: 'user-1', displayName: 'Ana', email: 'ana@example.test', role: 'admin' },
        { uid: 'user-2', displayName: 'Beto', email: 'beto@example.test', role: 'member' },
      ]);
      return () => undefined;
    },
    execute: () => Promise.resolve({ ok: true }),
  };
  const fake = createFakeLinksService();
  const analyticsService: AnalyticsService = {
    loadDaily: () => Promise.resolve({ ok: true, points: [] }),
  };
  const router = createMemoryRouter(routes, {
    initialEntries: [path],
  });
  const user = userEvent.setup();
  render(
    <AuthProvider service={authService}>
      <TeamsProvider service={teamsService}>
        <MembersProvider service={membersService}>
          <AnalyticsProvider service={analyticsService}>
            <LinksProvider service={fake.service}>
              <RouterProvider router={router} />
            </LinksProvider>
          </AnalyticsProvider>
        </MembersProvider>
      </TeamsProvider>
    </AuthProvider>,
  );
  return { ...fake, router, user };
}

describe('fluxo de links', () => {
  it('administrador atravessa carregamento, vazio, criação, lista e cópia', async () => {
    const fake = renderLinks();
    expect(await screen.findByText('Carregando links...')).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        'team-1',
        'admin',
        'user-1',
        expect.any(Function),
        expect.any(Function),
      ),
    );
    act(() => fake.emit([]));
    expect(await screen.findByText('Nenhum link disponível')).toBeInTheDocument();

    await fake.user.type(screen.getByLabelText('Endereço curto'), 'Campanha-2026');
    await fake.user.type(screen.getByLabelText('URL de destino'), 'https://example.com/campanha');
    expect(screen.getByText('Prévia: https://go.example.test/campanha-2026')).toBeVisible();
    await fake.user.click(screen.getByRole('button', { name: 'Criar link' }));
    expect(fake.create).toHaveBeenCalledWith(
      'team-1',
      'Campanha-2026',
      'https://example.com/campanha',
    );
    expect(await screen.findByText('https://go.example.test/campanha-2026')).toBeVisible();

    act(() => fake.emit([CREATED_LINK]));
    const row = await screen.findByRole('row', { name: /campanha-2026/i });
    expect(within(row).getByText('Ana')).toBeVisible();
    expect(within(row).getByText('Ativo')).toBeVisible();
    await fake.user.click(within(row).getByRole('button', { name: 'Copiar' }));
    expect(fake.copy).toHaveBeenCalledWith('https://go.example.test/campanha-2026');
    expect(
      await screen.findByText('Link https://go.example.test/campanha-2026 copiado.'),
    ).toBeVisible();
  });

  it('membro usa a consulta restrita e recebe somente o conteúdo emitido', async () => {
    const fake = renderLinks('member');
    await vi.waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        'team-1',
        'member',
        'user-1',
        expect.any(Function),
        expect.any(Function),
      ),
    );
    act(() => fake.emit([CREATED_LINK]));
    expect(await screen.findByText('Você vê apenas os links criados por você.')).toBeVisible();
    expect(screen.getByText('/campanha-2026')).toBeVisible();
  });

  it('liga validações e conflito aos campos corretos', async () => {
    const fake = renderLinks();
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() => fake.emit([]));
    await fake.user.type(await screen.findByLabelText('Endereço curto'), 'app');
    await fake.user.type(screen.getByLabelText('URL de destino'), '/relativo');
    await fake.user.click(screen.getByRole('button', { name: 'Criar link' }));
    expect(await screen.findByText('Este endereço é reservado pelo sistema.')).toBeVisible();
    expect(fake.create).not.toHaveBeenCalled();

    await fake.user.clear(screen.getByLabelText('Endereço curto'));
    await fake.user.type(screen.getByLabelText('Endereço curto'), 'disponivel');
    await fake.user.click(screen.getByRole('button', { name: 'Criar link' }));
    expect(
      await screen.findByText('Informe um destino absoluto iniciado por http:// ou https://.'),
    ).toBeVisible();

    await fake.user.clear(screen.getByLabelText('URL de destino'));
    await fake.user.type(screen.getByLabelText('URL de destino'), 'https://example.com');
    fake.create.mockResolvedValueOnce({
      ok: false,
      failure: {
        code: 'links/conflict',
        field: 'slug',
        message: 'Este endereço curto já está em uso.',
      },
    });
    await fake.user.click(screen.getByRole('button', { name: 'Criar link' }));
    expect(await screen.findByText('Este endereço curto já está em uso.')).toBeVisible();
  });

  it('mostra falha de leitura e permite tentar novamente', async () => {
    const fake = renderLinks();
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() =>
      fake.emitError({ code: 'links/unavailable', message: 'Não foi possível acessar os links.' }),
    );
    expect(await screen.findByText('Não foi possível carregar os links')).toBeVisible();
    await fake.user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(fake.subscribe).toHaveBeenCalledTimes(2);
  });

  it('filtra arquivados e abre o detalhe para editar e mudar estado', async () => {
    const fake = renderLinks();
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    const archived = { ...CREATED_LINK, slug: 'antigo', status: 'archived' as const };
    act(() => fake.emit([CREATED_LINK, archived]));
    await fake.user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'archived');
    expect(screen.getByText('/antigo')).toBeVisible();
    expect(screen.queryByText('/campanha-2026')).not.toBeInTheDocument();
    await fake.user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'all');

    const row = screen.getByRole('row', { name: /campanha-2026/i });
    await fake.user.click(within(row).getByRole('link', { name: 'Gerenciar' }));
    expect(await screen.findByRole('heading', { name: '/campanha-2026' })).toBeVisible();
    const destination = screen.getByLabelText('URL de destino');
    await fake.user.clear(destination);
    await fake.user.type(destination, 'http://example.com/novo');
    await fake.user.click(screen.getByRole('button', { name: 'Salvar destino' }));
    expect(fake.updateDestination).toHaveBeenCalledWith(
      'team-1',
      'campanha-2026',
      'http://example.com/novo',
    );
    expect(await screen.findByText('Destino atualizado.')).toBeVisible();

    await fake.user.click(screen.getByRole('button', { name: 'Desativar' }));
    await fake.user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }),
    );
    expect(fake.changeStatus).toHaveBeenCalledWith('team-1', 'campanha-2026', 'disable');
  });

  it('pagina o histórico na tela de detalhe', async () => {
    const fake = renderLinks();
    fake.loadHistory
      .mockResolvedValueOnce({
        entries: [
          {
            id: 'event-2',
            action: 'destination_changed',
            actorId: 'user-1',
            previousValue: 'https://example.com/antes',
            nextValue: 'https://example.com/depois',
            createdAt: '2026-08-16T12:00:00.000Z',
          },
        ],
        nextCursor: { id: 'event-2', createdAt: '2026-08-16T12:00:00.000Z' },
      })
      .mockResolvedValueOnce({
        entries: [
          {
            id: 'event-1',
            action: 'created',
            actorId: 'user-1',
            previousValue: null,
            nextValue: 'https://example.com/antes',
            createdAt: '2026-08-15T12:00:00.000Z',
          },
        ],
        nextCursor: null,
      });
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() => fake.emit([CREATED_LINK]));
    await fake.user.click(
      within(await screen.findByRole('row', { name: /campanha-2026/i })).getByRole('link', {
        name: 'Gerenciar',
      }),
    );
    expect(await screen.findByText('Destino alterado')).toBeVisible();
    await fake.user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByText('Link criado')).toBeVisible();
    expect(fake.loadHistory).toHaveBeenLastCalledWith('campanha-2026', {
      id: 'event-2',
      createdAt: '2026-08-16T12:00:00.000Z',
    });
  });
});
