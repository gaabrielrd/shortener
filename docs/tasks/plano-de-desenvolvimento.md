# Plano de desenvolvimento — Short Links

**Status:** pronto para execução  
**Última atualização:** 2026-08-15  
**Fonte do escopo:** [PRD](../prd.md) e [arquitetura](../architecture.md)

## Objetivo

Entregar a primeira versão do Short Links em incrementos pequenos, verificáveis
e ordenados por dependência: Firebase, autenticação, equipes, permissões,
convites, gestão de links, redirecionamento, analytics e entrega piloto.

Cada tarefa deve produzir um incremento integrável, manter `npm run validate`
verde e atualizar testes e documentação. Nenhuma tarefa pode antecipar itens do
não escopo do PRD.

## Estado inicial

- SPA React + TypeScript + Vite com shell, roteamento e styleguide.
- Nenhuma dependência ou configuração Firebase instalada.
- Nenhum diretório de Cloud Functions, regra Firestore ou índice composto.
- Testes Vitest, contratos de arquitetura, Playwright e CI já configurados.
- O E2E herdado ainda descreve a demonstração removida e deverá ser substituído
  antes da entrega piloto.

## Requisitos cobertos

O conjunto das tarefas cobre `RF-01` a `RF-11`, `RN-01` a `RN-16` e `CA-01` a
`CA-15` do PRD. A rastreabilidade detalhada aparece em cada arquivo de tarefa.

## Não escopo global

- Login por senha, e-mail ou provedor diferente do Google.
- Criação anônima de links.
- Domínios personalizados por equipe.
- Expiração automática de links.
- Eventos individuais, visitante único, IP, origem, localização ou dispositivo.
- Exclusão definitiva de equipe ou reutilização de identificador arquivado.
- Aplicativo nativo, PWA ou funcionamento offline.
- Biblioteca de gráficos, estado global ou cliente HTTP sem necessidade
  demonstrada.

## Suposições de execução

- Cloud Functions de segunda geração serão escritas em TypeScript e usarão uma
  versão Node compatível com as dependências e com o runtime Firebase.
- Desenvolvimento e testes integrados usarão um projeto `demo-` no Emulator
  Suite; nenhum teste automatizado acessará recursos reais.
- O identificador do projeto real, domínio final e região serão configurados na
  tarefa de fundação/entrega, sem segredos versionados.
- Leituras autorizadas poderão usar o SDK Web do Firestore. Escritas que exigem
  invariantes, auditoria ou coordenação serão feitas por Functions; Security
  Rules negarão gravações diretas equivalentes.
- Um link será identificado pelo slug normalizado no backend, garantindo
  unicidade global e reserva permanente após arquivamento.
- Cada tarefa poderá ser entregue em um PR próprio e só começa quando suas
  dependências estiverem concluídas.
- A versão local do Node será alinhada antes de instalar Firebase; o ambiente
  atual `24.14.1` não satisfaz a engine declarada por `jsdom@30.0.1`.

## Solução mínima

```text
Navegador administrativo
  -> Firebase Authentication (Google)
  -> leituras autorizadas no Firestore
  -> callable Functions para mutações protegidas

Visitante público
  -> Firebase Hosting
  -> HTTPS Function de redirecionamento
  -> Firestore (link + agregados diários)
  -> resposta 302 para o destino atual
```

O cliente será dividido nas features públicas `auth`, `teams`, `links` e
`analytics`. Inicialização e conexão com emuladores ficam em infraestrutura
neutra de `shared`. O backend terá módulos de domínio equivalentes, mas não será
importado pelo bundle do navegador.

## Modelo de dados planejado

| Caminho lógico                          | Conteúdo                                 | Escrita                          |
| --------------------------------------- | ---------------------------------------- | -------------------------------- |
| `users/{uid}`                           | perfil mínimo Google e timestamps        | função de perfil                 |
| `teams/{teamId}`                        | nome, criador e timestamps               | funções de equipe                |
| `teams/{teamId}/members/{uid}`          | nível, perfil interno e associação       | funções de membros/convites      |
| `inviteTokens/{tokenHash}`              | equipe, validade, estado e criador       | funções de convite               |
| `links/{slug}`                          | destino, equipe, criador, estado e total | funções de link/redirecionamento |
| `links/{slug}/history/{entryId}`        | ação, autor, data e valores              | mesma transação da alteração     |
| `links/{slug}/dailyClicks/{YYYY-MM-DD}` | quantidade agregada em UTC               | função de redirecionamento       |

O token de convite será opaco e de alta entropia; somente seu hash será
persistido. As coleções e campos finais devem ser registrados no ADR de dados da
tarefa 0001 antes da primeira implementação de negócio.

## Ordem e dependências

| Ordem | Tarefa                                                             | Depende de | PRD principal                         |
| ----- | ------------------------------------------------------------------ | ---------- | ------------------------------------- |
| 0001  | [Fundação Firebase](0001-fundacao-firebase.md)                     | nenhuma    | integrações, RN-16                    |
| 0002  | [Autenticação Google](0002-autenticacao-google.md)                 | 0001       | RF-01, CA-01                          |
| 0003  | [Equipes e contexto ativo](0003-equipes-e-contexto-ativo.md)       | 0002       | RF-02, RN-02/03, CA-02                |
| 0004  | [Membros e permissões](0004-membros-e-permissoes.md)               | 0003       | RF-03, RN-04/06/07, CA-10/11/14       |
| 0005  | [Convites reutilizáveis](0005-convites-reutilizaveis.md)           | 0004       | RF-04, RN-05, CA-03/04                |
| 0006  | [Criação e listagem de links](0006-criacao-e-listagem-de-links.md) | 0005       | RF-05/06, RN-08/09/10, CA-05/06       |
| 0007  | [Ciclo de vida e histórico](0007-ciclo-de-vida-e-historico.md)     | 0006       | RF-07/08/11, RN-11/12/13/15, CA-12/13 |
| 0008  | [Redirecionamento e contagem](0008-redirecionamento-e-contagem.md) | 0007       | RF-09, RN-01/14, CA-07/08             |
| 0009  | [Analytics e detalhe](0009-analytics-e-detalhe.md)                 | 0008       | RF-10/11, CA-09                       |
| 0010  | [Segurança e entrega piloto](0010-seguranca-e-entrega-piloto.md)   | 0001–0009  | CA-01–15 e meta do piloto             |

## Estratégia de testes

- Unidade: normalização, validação, permissões e transições de estado.
- Componente: resultados visíveis, teclado e estados carregando/vazio/erro/sucesso.
- Rules: acesso permitido e negado com Auth + Firestore Emulator.
- Functions: transações, concorrência, idempotência e resposta HTTP nos
  emuladores.
- E2E: jornada crítica no Chromium usando somente o projeto `demo-`.
- Produção: smoke pós-deploy do domínio administrativo e de um link controlado.

Cada tarefa executa testes direcionados durante o desenvolvimento e termina com
`npm run validate`. Tarefas com Firebase também executam seu comando de testes
no Emulator Suite. A tarefa 0010 executa a suíte E2E completa.

## Riscos globais

- **Autorização inconsistente:** concentrar invariantes no backend e testar
  negações nas Rules, não confiar na interface.
- **Concorrência:** usar transações/atualizações atômicas para slug, último
  administrador, associação por convite e contadores.
- **Token de convite repassado:** hash em repouso, validade, cancelamento e logs
  sem token integral.
- **Colisão entre SPA e slugs:** reservar rotas administrativas e ordenar os
  rewrites do Hosting antes do catch-all público.
- **Custo ou latência de Functions:** definir região, medir redirecionamento e
  configurar alertas antes do piloto.
- **Testes contra produção:** usar IDs `demo-` e falhar se um recurso não
  emulado for solicitado durante testes.
- **Crescimento ilimitado:** histórico e agregados são requisitos; consultas
  precisam paginação e índices, sem carregar toda a coleção.

## Referências oficiais

- [Login Google no Firebase Authentication](https://firebase.google.com/docs/auth/web/google-signin)
- [Transações e escritas atômicas no Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Hosting com Cloud Functions](https://firebase.google.com/docs/hosting/functions)
- [Instalação e configuração do Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure)

## Definição de concluído do plano

- Todas as tarefas 0001–0010 concluídas na ordem de dependência.
- Todos os critérios `CA-01`–`CA-15` cobertos por testes observáveis.
- Security Rules e Functions negam acessos e mutações não autorizados.
- `npm run validate` e `npm run test:e2e` passam.
- Deploy e smoke de produção documentados e verificados.
- Nenhuma decisão obrigatória permanece aberta; desvios viram atualização do
  PRD, arquitetura ou ADR antes do código.
