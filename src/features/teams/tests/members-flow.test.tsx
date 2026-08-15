import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '@/app/routes';
import { AuthProvider, type AuthService } from '@/features/auth';
import { MembersProvider, TeamsProvider, type Team, type TeamsService } from '@/features/teams';
import { createFakeMembersService } from './fakeMembersService';

const authService: AuthService = {
  subscribe(onUser) {
    onUser({ uid: 'user-1', displayName: 'Ana', email: 'ana@example.com' });
    return () => undefined;
  },
  ensureProfile: () => Promise.resolve(),
  startGoogleSignIn: () => Promise.resolve(null),
  signOut: () => Promise.resolve(null),
  takeReturnPath: () => null,
};

function renderMembers(role: Team['role'] = 'admin') {
  const team: Team = { id: 'team-1', name: 'Comunicação', role };
  const teamsService: TeamsService = {
    subscribe(_uid, onTeams) {
      onTeams([team]);
      return () => undefined;
    },
    createTeam: () => Promise.resolve({ ok: true, team }),
  };
  const members = createFakeMembersService();
  const router = createMemoryRouter(routes, { initialEntries: ['/app/equipes/team-1/membros'] });
  const user = userEvent.setup();
  render(
    <AuthProvider service={authService}>
      <TeamsProvider service={teamsService}>
        <MembersProvider service={members.service}>
          <RouterProvider router={router} />
        </MembersProvider>
      </TeamsProvider>
    </AuthProvider>,
  );
  return { ...members, router, user };
}

const TEAM_MEMBERS = [
  { uid: 'user-1', displayName: 'Ana', email: 'ana@example.com', role: 'admin' as const },
  { uid: 'user-2', displayName: 'Beto', email: 'beto@example.com', role: 'member' as const },
];

describe('gestão de membros', () => {
  it('administrador lista membros e promove com confirmação observável', async () => {
    const fake = renderMembers();
    await vi.waitFor(() =>
      expect(fake.subscribe).toHaveBeenCalledWith(
        'team-1',
        expect.any(Function),
        expect.any(Function),
      ),
    );
    act(() => fake.emitMembers(TEAM_MEMBERS));

    expect(
      await screen.findByRole('heading', { name: 'Membros de Comunicação' }),
    ).toBeInTheDocument();
    expect(screen.getByText('beto@example.com')).toBeInTheDocument();
    await fake.user.click(screen.getByRole('button', { name: 'Promover' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/poderá administrar membros/i)).toBeInTheDocument();
    await fake.user.click(within(dialog).getByRole('button', { name: 'Promover' }));

    expect(fake.execute).toHaveBeenCalledWith({
      action: 'change-role',
      teamId: 'team-1',
      targetUid: 'user-2',
      role: 'admin',
    });
    expect(await screen.findByText('Membro promovido a administrador.')).toBeInTheDocument();
  });

  it('membro comum vê a lista sem receber ações administrativas', async () => {
    const fake = renderMembers('member');
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() => fake.emitMembers(TEAM_MEMBERS));

    expect(await screen.findByText('beto@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Promover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair da equipe' })).toBeInTheDocument();
  });

  it('mostra a proteção devolvida pelo backend ao rebaixar o último administrador', async () => {
    const fake = renderMembers();
    fake.execute.mockResolvedValueOnce({
      ok: false,
      failure: {
        code: 'members/last-admin',
        message: 'Promova outro membro antes de remover ou rebaixar o último administrador.',
      },
    });
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() => fake.emitMembers([TEAM_MEMBERS[0]!]));

    await fake.user.click(await screen.findByRole('button', { name: 'Rebaixar' }));
    await fake.user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Rebaixar' }),
    );

    expect(await screen.findByText(/promova outro membro antes/i)).toBeInTheDocument();
  });

  it('administrador remove outro membro somente depois da confirmação', async () => {
    const fake = renderMembers();
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() => fake.emitMembers(TEAM_MEMBERS));
    const memberRow = screen.getByRole('row', { name: /beto@example\.com/i });

    await fake.user.click(within(memberRow).getByRole('button', { name: 'Remover' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/links que ela criou permanecerão/i)).toBeInTheDocument();
    await fake.user.click(within(dialog).getByRole('button', { name: 'Remover membro' }));

    expect(fake.execute).toHaveBeenCalledWith({
      action: 'remove',
      teamId: 'team-1',
      targetUid: 'user-2',
    });
    expect(await screen.findByText('Membro removido.')).toBeInTheDocument();
  });

  it('membro pode sair da equipe e volta ao contexto de equipes', async () => {
    const fake = renderMembers('member');
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() => fake.emitMembers(TEAM_MEMBERS));

    await fake.user.click(screen.getByRole('button', { name: 'Sair da equipe' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/seus links permanecerão/i)).toBeInTheDocument();
    await fake.user.click(within(dialog).getByRole('button', { name: 'Sair da equipe' }));

    expect(fake.execute).toHaveBeenCalledWith({ action: 'leave', teamId: 'team-1' });
    await vi.waitFor(() => expect(fake.router.state.location.pathname).toBe('/app'));
  });

  it('cobre falha de leitura e nova tentativa', async () => {
    const fake = renderMembers();
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() =>
      fake.emitError({
        code: 'members/unavailable',
        message: 'Não foi possível acessar os membros.',
      }),
    );

    expect(await screen.findByText('Não foi possível carregar os membros')).toBeInTheDocument();
    await fake.user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(fake.subscribe).toHaveBeenCalledTimes(2);
  });

  it('remove os dados da tela quando o acesso à equipe é revogado', async () => {
    const fake = renderMembers('member');
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() => fake.emitMembers(TEAM_MEMBERS));
    expect(await screen.findByText('beto@example.com')).toBeInTheDocument();

    act(() =>
      fake.emitError({
        code: 'members/forbidden',
        message: 'Você não pode gerenciar membros desta equipe.',
      }),
    );

    expect(await screen.findByText('Equipe não disponível')).toBeInTheDocument();
    expect(screen.queryByText('beto@example.com')).not.toBeInTheDocument();
  });
});
