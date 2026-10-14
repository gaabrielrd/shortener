import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router';
import { App } from '@/app/App';
import { RouteErrorFallback } from '@/app/components/RouteErrorFallback';
import { routes } from '@/app/routes';
import { AuthProvider, type AuthService } from '@/features/auth';
import { LinksProvider, type LinksService } from '@/features/links';
import {
  MembersProvider,
  TeamsProvider,
  type MembersService,
  type TeamsService,
} from '@/features/teams';

const authenticatedService: AuthService = {
  subscribe(onUser) {
    onUser({ uid: 'user-1', displayName: 'Ana Silva', email: 'ana@example.com' });
    return () => undefined;
  },
  ensureProfile: () => Promise.resolve(),
  startGoogleSignIn: () => Promise.resolve(null),
  signOut: () => Promise.resolve(null),
  takeReturnPath: () => null,
};

const teamsService: TeamsService = {
  subscribe(_uid, onTeams) {
    onTeams([{ id: 'team-1', name: 'Comunicação', role: 'admin' }]);
    return () => undefined;
  },
  createTeam: () =>
    Promise.resolve({
      ok: true,
      team: { id: 'team-created', name: 'Equipe Criada', role: 'admin' },
    }),
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

const membersService: MembersService = {
  subscribe(_teamId, onMembers) {
    onMembers([]);
    return () => undefined;
  },
  execute: () => Promise.reject(new Error('não usado neste teste')),
};

function renderAt(path: string, definitions: RouteObject[] = routes) {
  const router = createMemoryRouter(definitions, { initialEntries: [path] });
  return render(
    <AuthProvider service={authenticatedService}>
      <TeamsProvider service={teamsService}>
        <MembersProvider service={membersService}>
          <LinksProvider service={linksService}>
            <RouterProvider router={router} />
          </LinksProvider>
        </MembersProvider>
      </TeamsProvider>
    </AuthProvider>,
  );
}

/**
 * Smoke test da composicao: rotas, layout e paginas montam juntos.
 * Se um provider ou uma rota quebrar, falha aqui antes de chegar ao build.
 */
describe('composicao da aplicacao', () => {
  it('monta a rota administrativa com sessão e página inicial', async () => {
    renderAt('/app');

    expect(await screen.findByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Comunicação' })).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Início' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Styleguide' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Links' })).toHaveAttribute('aria-current', 'page');
  });

  it('abre e fecha o dropdown do usuário com opções de adicionar equipe e sair', async () => {
    const user = userEvent.setup();
    renderAt('/app');

    const menuTrigger = await screen.findByRole('button', { name: /Menu de Ana Silva/i });
    expect(screen.queryByRole('menu', { name: 'Opções do usuário' })).not.toBeInTheDocument();

    await user.click(menuTrigger);
    expect(screen.getByRole('menu', { name: 'Opções do usuário' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Adicionar equipe' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sair' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: 'Opções do usuário' })).not.toBeInTheDocument();
    expect(menuTrigger).toHaveFocus();
  });

  it('percorre as opções da conta por teclado e oferece acesso ao conteúdo', async () => {
    const user = userEvent.setup();
    renderAt('/app');
    const trigger = await screen.findByRole('button', { name: /Menu de Ana Silva/i });
    expect(screen.getByRole('link', { name: 'Ir para o conteúdo' })).toHaveAttribute(
      'href',
      '#workspace-content',
    );
    await user.click(trigger);
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Adicionar equipe' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Sair' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Adicionar equipe' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Sair' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Adicionar equipe' })).toHaveFocus();
  });

  it('mostra a tela de nao encontrado para um endereco desconhecido', async () => {
    renderAt('/rota-que-nao-existe');

    expect(await screen.findByRole('heading', { name: /nao encontrada/i })).toBeInTheDocument();
    // O layout continua visivel: o erro nao derruba a aplicacao inteira.
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});

describe('errorElement das rotas', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('substitui uma rota que lanca erro pela tela de falha', async () => {
    function Explode(): never {
      throw new Error('falha na rota');
    }

    renderAt('/', [
      {
        path: '/',
        element: <App />,
        errorElement: <RouteErrorFallback />,
        children: [{ index: true, element: <Explode /> }],
      },
    ]);

    expect(
      await screen.findByRole('heading', { name: /nao foi possivel carregar/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('falha na rota')).toBeInTheDocument();
  });

  it('trata uma resposta 404 lancada por um loader como pagina nao encontrada', async () => {
    renderAt('/', [
      {
        path: '/',
        element: <App />,
        errorElement: <RouteErrorFallback />,
        children: [
          {
            index: true,
            element: <p>nunca renderiza</p>,
            loader: () => {
              // Lancar uma Response e o idioma do react-router para sinalizar
              // status HTTP a partir de um loader.
              // eslint-disable-next-line @typescript-eslint/only-throw-error
              throw new Response(null, { status: 404 });
            },
          },
        ],
      },
    ]);

    expect(await screen.findByRole('heading', { name: /nao encontrada/i })).toBeInTheDocument();
  });
});
