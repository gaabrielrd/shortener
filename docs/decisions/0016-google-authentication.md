# ADR 0016: autenticação Google por redirect

## Status

Substituída pela [ADR 0025](0025-google-authentication-popup.md).

## Contexto

A área administrativa exige sessão, funciona em computador e celular e não
deve piscar conteúdo privado durante a restauração. O produto não oferece senha,
conta anônima ou outro provedor.

## Decisão

- Usar `GoogleAuthProvider` com `signInWithRedirect`. O retorno é processado por
  `getRedirectResult` para transformar cancelamentos e falhas em mensagens
  recuperáveis.
- Em Firebase Hosting `*.web.app`, usar o mesmo host servido como `authDomain`.
  Isso mantém o helper de autenticação na origem da SPA e evita perda do estado
  do redirect quando o navegador bloqueia armazenamento de terceiros.
- Manter os estados `initializing`, `unauthenticated`, `authenticating`,
  `authenticated` e `error` no `AuthProvider` da feature `auth`.
- Guardar temporariamente apenas uma rota interna sanitizada em
  `sessionStorage`, dentro do serviço de autenticação. URLs externas, `//` e a
  própria entrada voltam para `/app`.
- Proteger a árvore administrativa com `ProtectedRoute`; `/login` e
  `/styleguide` ficam fora dela. Futuras rotas públicas devem permanecer fora
  da guarda.
- Criar ou atualizar `users/{uid}` pela callable Function
  `ensureUserProfile`, somente para tokens com `sign_in_provider` igual a
  `google.com`. O documento contém apenas UID, nome, e-mail e timestamps.
- Ocultar a árvore administrativa antes de aguardar a confirmação remota do
  logout. Uma falha posterior mantém a pessoa fora da área protegida.

## Consequências

- Sessões válidas são restauradas pela persistência padrão local do Firebase.
- O domínio de produção e `https://<dominio>/__/auth/handler` precisam estar
  autorizados no provedor Google antes do deploy.
- Testes de navegador usam o widget Google do Auth Emulator e nunca chamam o
  provedor real.
- Equipes e autorização de recursos continuam fora desta decisão.
