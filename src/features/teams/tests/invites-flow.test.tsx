import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '@/app/routes';
import { AuthProvider, type AuthService } from '@/features/auth';
import { LinksProvider, type LinksService } from '@/features/links';
import {
  InvitesProvider,
  MembersProvider,
  TeamsProvider,
  type MembersService,
  type Team,
  type TeamsService,
} from '@/features/teams';
import { CREATED_INVITE, createFakeInvitesService } from './fakeInvitesService';

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
const membersService: MembersService = {
  subscribe: () => () => undefined,
  execute: () => Promise.resolve({ ok: true }),
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

function renderInvites(
  path: string,
  role: Team['role'] = 'admin',
  withTeam = true,
  consumeFailure?: { readonly code: 'invites/expired'; readonly message: string },
) {
  const team: Team = { id: 'team-1', name: 'Comunicação', role };
  let teamAvailable = withTeam;
  const teamsService: TeamsService = {
    subscribe(_uid, onTeams) {
      onTeams(teamAvailable ? [team] : []);
      return () => undefined;
    },
    createTeam: () => Promise.resolve({ ok: true, team }),
  };
  const fake = createFakeInvitesService();
  if (consumeFailure !== undefined) {
    fake.consume.mockResolvedValueOnce({ ok: false, failure: consumeFailure });
  } else if (!withTeam) {
    fake.consume.mockImplementationOnce(() => {
      teamAvailable = true;
      return Promise.resolve({
        ok: true,
        teamId: 'team-1',
        teamName: 'Comunicação',
        alreadyMember: false,
      });
    });
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  render(
    <AuthProvider service={authService}>
      <TeamsProvider service={teamsService}>
        <MembersProvider service={membersService}>
          <InvitesProvider service={fake.service}>
            <LinksProvider service={linksService}>
              <RouterProvider router={router} />
            </LinksProvider>
          </InvitesProvider>
        </MembersProvider>
      </TeamsProvider>
    </AuthProvider>,
  );
  return { ...fake, router, user };
}

describe('fluxo de convites', () => {
  it('administrador cria, copia, lista e cancela um convite', async () => {
    const fake = renderInvites('/app/equipes/team-1/convites');
    await vi.waitFor(() => expect(fake.subscribe).toHaveBeenCalledOnce());
    act(() => fake.emit([]));
    expect(await screen.findByText('Nenhum convite criado')).toBeInTheDocument();

    await fake.user.clear(screen.getByLabelText('Validade do convite'));
    await fake.user.type(screen.getByLabelText('Validade do convite'), '2030-01-01T10:00');
    await fake.user.click(screen.getByRole('button', { name: 'Criar convite' }));
    expect(fake.create).toHaveBeenCalledWith('team-1', expect.stringContaining('2030-01-01'));
    const link = await screen.findByLabelText('Link do convite');
    expect((link as HTMLInputElement).value).toContain(`/invite/${'T'.repeat(43)}`);
    await fake.user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(fake.copy).toHaveBeenCalledWith(expect.stringContaining('/invite/'));
    expect(await screen.findByText('Link copiado.')).toBeInTheDocument();

    act(() => fake.emit([CREATED_INVITE]));
    const row = await screen.findByRole('row', { name: /Ativo Cancelar/i });
    await fake.user.click(within(row).getByRole('button', { name: 'Cancelar' }));
    await fake.user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar convite' }),
    );
    expect(fake.cancel).toHaveBeenCalledWith('team-1', 'hash-1');
  });

  it('membro comum não recebe a administração de convites', async () => {
    renderInvites('/app/equipes/team-1/convites', 'member');
    expect(await screen.findByText('Convites não disponíveis')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar convite' })).not.toBeInTheDocument();
  });

  it('consome o token sem exibi-lo e oferece a equipe resultante', async () => {
    const token = 'Z'.repeat(43);
    const fake = renderInvites(`/invite/${token}`, 'member', false);

    expect(await screen.findByText('Convite aceito')).toBeInTheDocument();
    expect(fake.consume).toHaveBeenCalledWith(token);
    expect(screen.queryByText(token)).not.toBeInTheDocument();
    await fake.user.click(screen.getByRole('button', { name: 'Abrir equipe' }));
    await vi.waitFor(() =>
      expect(fake.router.state.location.pathname).toBe('/app/equipes/team-1/links'),
    );
  });

  it('explica convite vencido sem revelar o token', async () => {
    const token = 'Y'.repeat(43);
    renderInvites(`/invite/${token}`, 'member', false, {
      code: 'invites/expired',
      message: 'Este convite já venceu.',
    });

    expect(await screen.findByText('Convite não disponível')).toBeInTheDocument();
    expect(screen.getByText('Este convite já venceu.')).toBeInTheDocument();
    expect(screen.queryByText(token)).not.toBeInTheDocument();
  });
});
