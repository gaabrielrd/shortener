import { StyleguidePage } from '@vitru/styleguide/showcase';
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router';
import { App } from '@/app/App';
import { NotFound, RouteErrorFallback } from '@/app/components/RouteErrorFallback';
import { LoginPage, ProtectedRoute } from '@/features/auth';
import { LinkDetailPage, LinksPage } from '@/features/links';
import {
  InviteEntryPage,
  InvitesPage,
  MembersPage,
  TeamsPage,
  TeamWorkspace,
} from '@/features/teams';

/** Definição separada do router para permitir a mesma árvore em testes. */
export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/styleguide',
    element: <StyleguidePage />,
    errorElement: <RouteErrorFallback />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <App />,
        errorElement: <RouteErrorFallback />,
        children: [
          { index: true, element: <Navigate to="app" replace /> },
          { path: 'app', element: <TeamsPage /> },
          {
            path: 'app/equipes/:teamId',
            element: <TeamWorkspace />,
            children: [
              { index: true, element: <Navigate to="links" replace /> },
              { path: 'links', element: <LinksPage /> },
              { path: 'links/:slug', element: <LinkDetailPage /> },
              { path: 'membros', element: <MembersPage /> },
              { path: 'convites', element: <InvitesPage /> },
            ],
          },
          { path: 'invite/:token', element: <InviteEntryPage /> },
          // A curinga administrativa permanece por último.
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
