import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/routes';
import { AuthProvider, type AuthUser } from '@/features/auth';
import { LinksProvider, type LinksService } from '@/features/links';
import {
  MembersProvider,
  TeamsProvider,
  type MembersService,
  type TeamsService,
} from '@/features/teams';
import { createFakeAuthService } from './fakeAuthService';

const ANA: AuthUser = {
  uid: 'user-1',
  displayName: 'Ana Silva',
  email: 'ana@example.com',
};

const teamsService: TeamsService = {
  subscribe(_uid, onTeams) {
    onTeams([{ id: 'team-test', name: 'Equipe Teste', role: 'admin' }]);
    return () => undefined;
  },
  createTeam: () =>
    Promise.resolve({
      ok: true,
      team: { id: 'team-created', name: 'Equipe Criada', role: 'admin' },
    }),
};

const membersService: MembersService = {
  subscribe(_teamId, onMembers) {
    onMembers([]);
    return () => undefined;
  },
  execute: () => Promise.reject(new Error('não usado neste teste')),
};

const linksService: LinksService = {
  subscribe(_teamId, _role, _uid, onLinks) {
    onLinks([]);
    return () => undefined;
  },
  create: () => Promise.reject(new Error('não usado neste teste')),
  updateDestination: () => Promise.reject(new Error('não usado neste teste')),
  changeStatus: () => Promise.reject(new Error('não usado neste teste')),
  loadHistory: () => Promise.reject(new Error('não usado neste teste')),
  publicUrl: (slug) => `https://go.example.test/${slug}`,
  copy: () => Promise.resolve(false),
};

function renderApp(
  path = '/app',
  configure?: (fake: ReturnType<typeof createFakeAuthService>) => void,
) {
  const fake = createFakeAuthService();
  configure?.(fake);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  render(
    <AuthProvider service={fake.service}>
      <TeamsProvider service={teamsService}>
        <MembersProvider service={membersService}>
          <LinksProvider service={linksService}>
            <RouterProvider router={router} />
          </LinksProvider>
        </MembersProvider>
      </TeamsProvider>
    </AuthProvider>,
  );
  return { ...fake, router, user };
}

describe('fluxo de autenticação', () => {
  it('não mostra conteúdo administrativo antes de restaurar a sessão', async () => {
    const fake = renderApp();

    expect(screen.getByText('Restaurando sua sessão...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Equipe Teste' })).not.toBeInTheDocument();

    act(() => fake.emitUser(null));

    expect(await screen.findByRole('heading', { name: 'Acesso interno' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Equipe Teste' })).not.toBeInTheDocument();
  });

  it('entra por teclado e retorna à rota administrativa pretendida', async () => {
    const fake = renderApp('/app?filtro=meus');
    act(() => fake.emitUser(null));
    const button = await screen.findByRole('button', { name: 'Entrar com Google' });

    await fake.user.tab();
    expect(button).toHaveFocus();
    await fake.user.keyboard('{Enter}');

    expect(fake.startGoogleSignIn).toHaveBeenCalledWith('/app?filtro=meus');
    act(() => fake.emitUser(ANA));

    expect(await screen.findByRole('heading', { name: 'Equipe Teste' })).toBeInTheDocument();
    expect(fake.router.state.location.pathname).toBe('/app/equipes/team-test/links');
  });

  it('inicializa o Google One Tap e conclui a entrada pela credencial', async () => {
    const fake = renderApp('/app?filtro=meus');
    act(() => fake.emitUser(null));

    expect(await screen.findByRole('heading', { name: 'Acesso interno' })).toBeInTheDocument();
    expect(fake.initializeGoogleOneTap).toHaveBeenCalledWith(
      expect.objectContaining({ returnPath: '/app?filtro=meus' }),
    );

    await act(async () => {
      await fake.triggerOneTapCredential('token-one-tap-123');
    });

    expect(fake.signInWithCredential).toHaveBeenCalledWith('token-one-tap-123', '/app?filtro=meus');

    act(() => fake.emitUser(ANA));

    expect(await screen.findByRole('heading', { name: 'Equipe Teste' })).toBeInTheDocument();
    expect(fake.router.state.location.pathname).toBe('/app');
  });

  it('trata falha de credencial do One Tap e exceção inesperada', async () => {
    const fake = renderApp('/login', (configured) => {
      configured.signInWithCredential.mockResolvedValueOnce({
        code: 'auth/provider',
        message: 'Credencial inválida.',
      });
    });
    act(() => fake.emitUser(null));

    await act(async () => {
      await fake.triggerOneTapCredential('bad-token');
    });

    expect(await screen.findByText('Credencial inválida.')).toBeInTheDocument();

    fake.signInWithCredential.mockRejectedValueOnce(new Error('crash'));
    await act(async () => {
      await fake.triggerOneTapCredential('crash-token');
    });

    expect(
      await screen.findByText('O Google não concluiu a autenticação. Tente novamente.'),
    ).toBeInTheDocument();
  });

  it('mantém a pessoa desconectada após falha e permite tentar novamente', async () => {
    const fake = renderApp();
    fake.startGoogleSignIn.mockRejectedValue(new Error('provider unavailable'));
    act(() => fake.emitUser(null));

    await fake.user.click(await screen.findByRole('button', { name: 'Entrar com Google' }));

    expect(
      await screen.findByText('O Google não concluiu a autenticação. Tente novamente.'),
    ).toBeInTheDocument();
    await fake.user.click(screen.getByRole('button', { name: 'Entrar com Google' }));
    expect(fake.startGoogleSignIn).toHaveBeenCalledTimes(2);
  });

  it('só libera a administração depois de preparar o perfil', async () => {
    const fake = renderApp();
    let completeProfile: (() => void) | undefined;
    fake.ensureProfile.mockImplementation(
      () => new Promise<void>((resolve) => (completeProfile = resolve)),
    );

    act(() => fake.emitUser(ANA));
    expect(screen.getByText('Restaurando sua sessão...')).toBeInTheDocument();
    expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument();

    await act(async () => {
      completeProfile?.();
      await Promise.resolve();
    });

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
  });

  it('oculta a administração imediatamente ao sair', async () => {
    const fake = renderApp();
    let finishSignOut: (() => void) | undefined;
    fake.signOut.mockImplementation(
      () => new Promise<null>((resolve) => (finishSignOut = () => resolve(null))),
    );
    act(() => fake.emitUser(ANA));
    await screen.findByRole('heading', { name: 'Equipe Teste' });

    await fake.user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Acesso interno' })).toBeInTheDocument();
    expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument();
    await act(async () => {
      finishSignOut?.();
      await Promise.resolve();
    });
  });

  it('trata exceção inesperada durante o logout', async () => {
    const fake = renderApp();
    fake.signOut.mockRejectedValueOnce(new Error('crash'));
    act(() => fake.emitUser(ANA));
    await screen.findByRole('heading', { name: 'Equipe Teste' });

    await fake.user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByText(/A sessão foi ocultada neste dispositivo/i)).toBeInTheDocument();
  });

  it('transforma falha de restauração em entrada recuperável', async () => {
    const fake = renderApp();

    act(() =>
      fake.emitError({ code: 'auth/network', message: 'Não foi possível restaurar a sessão.' }),
    );

    expect(await screen.findByText('Não foi possível restaurar a sessão.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeEnabled();
  });

  it('permanece no login e permite nova tentativa quando o popup é cancelado', async () => {
    const fake = renderApp('/login', (configured) => {
      configured.startGoogleSignIn.mockResolvedValue({
        code: 'auth/cancelled',
        message: 'O acesso com Google foi cancelado.',
      });
    });
    act(() => fake.emitUser(null));

    await fake.user.click(await screen.findByRole('button', { name: 'Entrar com Google' }));

    expect(await screen.findByText('O acesso com Google foi cancelado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeEnabled();
    expect(fake.router.state.location.pathname).toBe('/login');
  });

  it('não libera a administração quando o perfil falha', async () => {
    const fake = renderApp('/app', (configured) => {
      configured.ensureProfile.mockRejectedValue(new Error('firestore unavailable'));
    });

    act(() => fake.emitUser(ANA));

    expect(await screen.findByText(/o perfil não pôde ser preparado/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Equipe Teste' })).not.toBeInTheDocument();
  });
});
