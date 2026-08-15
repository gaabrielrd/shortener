# 0002 — Autenticação Google e sessão

**Status:** concluída em 2026-08-15  
**Dependências:** 0001  
**Rastreabilidade:** RF-01, RN-01, CA-01

## Contexto e objetivo

Toda administração exige uma conta Google. Esta tarefa entrega entrada, saída,
restauração de sessão e perfil mínimo, mantendo o redirecionamento público fora
da proteção.

## Requisitos

- Autenticar exclusivamente com Google pelo Firebase Authentication.
- Preservar estados de inicialização, desconectado, autenticando, autenticado e
  erro recuperável.
- Criar/atualizar perfil com UID, nome e e-mail sem guardar token OAuth.
- Proteger rotas administrativas e permitir retorno à rota desejada após login.
- Oferecer saída que remova imediatamente o conteúdo administrativo da tela.
- Funcionar por teclado e em computador/celular.

## Não escopo

- Senha, magic link, outro provedor, MFA ou restrição por domínio de e-mail.
- Equipes e autorização de recursos; entram nas tarefas seguintes.

## Suposições

- O popup será aberto diretamente pela ação da pessoa e manterá a SPA na rota
  atual; navegadores que o bloquearem recebem erro recuperável para nova tentativa.
- O Auth Emulator fornecerá identidades falsas nos testes, sem chamar Google.

## Proposta de solução

Criar a feature `auth` com serviço Firebase, provider de sessão e páginas de
entrada/erro. O provider entra na composição de `app/providers`; guardas de rota
consomem apenas a API pública da feature.

## Módulos e arquivos previstos

- `src/features/auth/{model,services,components,tests,index.ts}`.
- `src/app/providers/`, `src/app/routes/`, `src/test/render.tsx`.
- função ou serviço protegido para garantir o perfil `users/{uid}`.
- testes Auth Emulator e atualização do E2E.

## Tarefas sequenciais

- [x] Definir o contrato observável de sessão e erros estáveis.
- [x] Implementar adaptador Google Auth e conexão com Auth Emulator.
- [x] Criar provider que aguarda o primeiro estado de autenticação antes de
      renderizar conteúdo protegido.
- [x] Persistir o perfil mínimo de forma idempotente após login.
- [x] Criar tela de entrada com ação Google, carregamento e erro recuperável.
- [x] Proteger rotas administrativas, preservando rota/convite de retorno.
- [x] Implementar saída e limpeza do contexto autenticado.
- [x] Cobrir cancelamento, falha, restauração de sessão, logout e teclado.
- [x] Atualizar navegação e documentação afetada.

## Riscos

- Popup bloqueado ou fechado antes da conclusão do login.
- Conteúdo privado piscar antes da restauração da sessão.
- Testes dependerem do Google real.
- Domínio de produção ausente na lista autorizada do Firebase Authentication.

## Critérios de aceite

- [x] Usuário desconectado vê somente a entrada e não dados administrativos.
- [x] Login Google válido abre a rota administrativa pretendida.
- [x] Cancelamento ou falha mantém a pessoa desconectada e permite tentar de novo.
- [x] Recarregar preserva sessão válida sem piscar conteúdo indevido.
- [x] Sair encerra acesso imediatamente.
- [x] Perfil contém somente UID, nome, e-mail e timestamps necessários.
- [x] Testes usam Auth Emulator e `npm run validate` passa.

## Validação e documentação

- Testes unitários, de componente e integração com Auth Emulator.
- Smoke E2E de login/logout com usuário emulado.
- Atualizar arquitetura, variáveis e instruções de configuração do provedor.
