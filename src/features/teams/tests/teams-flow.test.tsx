import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '@/app/routes';
import { AuthProvider, type AuthService, type AuthUser } from '@/features/auth';
import { TeamsProvider } from '@/features/teams';
import { createFakeTeamsService } from './fakeTeamsService';

const authService: AuthService = {
  subscribe(onUser) {
    onUser({ uid: 'user-1', displayName: 'Ana Silva', email: 'ana@example.com' });
    return () => undefined;
  },
  ensureProfile: () => Promise.resolve(),
  startGoogleSignIn: () => Promise.resolve(null),
  signOut: () => Promise.resolve(null),
  takeReturnPath: () => null,
};

function createControlledAuthService() {
  let listener: ((user: AuthUser | null) => void) | undefined;
  const service: AuthService = {
    subscribe(onUser) {
      listener = onUser;
      return () => undefined;
    },
    ensureProfile: () => Promise.resolve(),
    startGoogleSignIn: () => Promise.resolve(null),
    signOut: () => Promise.resolve(null),
    takeReturnPath: () => null,
  };
  return { service, emit: (user: AuthUser | null) => listener?.(user) };
}

function renderTeams(path = '/app') {
  const fake = createFakeTeamsService();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  render(
    <AuthProvider service={authService}>
      <TeamsProvider service={fake.service}>
        <RouterProvider router={router} />
      </TeamsProvider>
    </AuthProvider>,
  );
  return { ...fake, router, user };
}

describe('equipes e contexto ativo', () => {
  it('cobre carregamento, vazio e criação da primeira equipe por teclado', async () => {
    const fake = renderTeams();
    expect(await screen.findByText('Carregando suas equipes...')).toBeInTheDocument();
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());

    act(() => fake.emitTeams([]));
    expect(
      await screen.findByRole('heading', { name: 'Crie seu primeiro espaço de trabalho' }),
    ).toBeInTheDocument();

    const input = screen.getByRole('textbox', { name: /nome da nova equipe/i });
    await fake.user.tab();
    await fake.user.tab();
    await fake.user.tab();
    await fake.user.tab();
    expect(input).toHaveFocus();
    await fake.user.keyboard('{Enter}');
    expect(await screen.findByText('Informe o nome da equipe.')).toBeInTheDocument();
    expect(fake.createTeam).not.toHaveBeenCalled();

    await fake.user.type(input, '  Comunicação  ');
    await fake.user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Comunicação' })).toBeInTheDocument();
    expect(fake.createTeam).toHaveBeenCalledWith('  Comunicação  ');
    expect(fake.router.state.location.pathname).toBe('/app/equipes/team-1');
  });

  it('lista múltiplas equipes e troca todo o contexto visível', async () => {
    const fake = renderTeams('/app/equipes/team-a');
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() =>
      fake.emitTeams([
        { id: 'team-a', name: 'Comunicação', role: 'admin' },
        { id: 'team-b', name: 'Eventos', role: 'member' },
      ]),
    );

    expect(await screen.findByRole('heading', { name: 'Comunicação' })).toBeInTheDocument();
    await fake.user.selectOptions(screen.getByRole('combobox', { name: 'Equipe ativa' }), 'team-b');

    expect(await screen.findByRole('heading', { name: 'Eventos' })).toBeInTheDocument();
    expect(screen.getByText('Membro')).toBeInTheDocument();
    expect(fake.router.state.location.pathname).toBe('/app/equipes/team-b');
  });

  it('não mostra dados para uma equipe manipulada na URL', async () => {
    const fake = renderTeams('/app/equipes/team-alheia');
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() => fake.emitTeams([{ id: 'team-a', name: 'Equipe Autorizada', role: 'admin' }]));

    expect(await screen.findByText('Equipe não disponível')).toBeInTheDocument();
    expect(screen.queryByText('Equipe Autorizada')).not.toBeInTheDocument();
  });

  it('expõe erro recuperável e refaz a assinatura ao tentar novamente', async () => {
    const fake = renderTeams();
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() =>
      fake.emitError({
        code: 'teams/unavailable',
        message: 'Não foi possível acessar as equipes. Tente novamente.',
      }),
    );

    expect(await screen.findByText('Não foi possível carregar suas equipes')).toBeInTheDocument();
    await fake.user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(fake.subscribe).toHaveBeenCalledTimes(2);
  });

  it('descarta o contexto anterior ao sair e entrar novamente com o mesmo UID', async () => {
    const auth = createControlledAuthService();
    const fake = createFakeTeamsService();
    const router = createMemoryRouter(routes, { initialEntries: ['/app'] });
    render(
      <AuthProvider service={auth.service}>
        <TeamsProvider service={fake.service}>
          <RouterProvider router={router} />
        </TeamsProvider>
      </AuthProvider>,
    );

    act(() => auth.emit({ uid: 'user-1', displayName: 'Ana', email: 'ana@example.com' }));
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() => fake.emitTeams([{ id: 'team-a', name: 'Equipe anterior', role: 'admin' }]));
    expect(await screen.findByRole('heading', { name: 'Equipe anterior' })).toBeInTheDocument();

    act(() => auth.emit(null));
    expect(await screen.findByRole('heading', { name: 'Acesso interno' })).toBeInTheDocument();
    act(() => auth.emit({ uid: 'user-1', displayName: 'Ana', email: 'ana@example.com' }));

    expect(await screen.findByText('Carregando suas equipes...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Equipe anterior' })).not.toBeInTheDocument();
  });
});
