# Arquitetura

Este documento descreve como o código do `Short Links` é organizado e as regras que mantêm o projeto simples e sustentável.

## Princípios

- Organização por funcionalidades (features), não por camadas técnicas.
- Cada parte tem uma responsabilidade clara.
- Simplicidade primeiro: só adicione abstração quando houver necessidade real.
- Regra de negócio fica nas features; a base (`app` e `shared`) permanece neutra.

## Documentos de produto e arquitetura

Ao iniciar um aplicativo a partir do template, use a skill `plan-app` para conduzir a descoberta antes de implementar. Ela cria `docs/prd.md` com o problema, os usuários, o escopo, o não escopo, os requisitos e os critérios de aceite aprovados.

Este arquivo continua sendo a fonte das decisões técnicas. A `plan-app` deve preservar as regras do template e acrescentar uma seção `Decisões do produto` com o limite do sistema, o mapa de features, o fluxo de dados, a persistência, as integrações e os trade-offs definidos para o aplicativo. O PRD explica **o que e por que** construir; a arquitetura explica **como o sistema será organizado**.

## Decisões do produto

### Limite do sistema

O Short Links é uma SPA administrativa em português do Brasil, responsiva para
computador e celular, acompanhada por um backend Firebase e por uma rota pública
de redirecionamento. A administração exige login Google. O acesso a um endereço
curto é público e não identifica o visitante.

A entrega usa um único domínio curto no Firebase Hosting. Rewrites encaminham o
identificador público a uma Cloud Function, que resolve somente links ativos,
incrementa os agregados de analytics e responde com redirecionamento temporário
para o destino atual. Links indisponíveis usam uma resposta pública genérica que
não revela equipe, criador nem destino. Não há funcionamento offline.

### Mapa de features

| Feature     | Responsabilidade                                                              | Interface pública esperada                                       |
| ----------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `auth`      | Sessão Google, perfil mínimo e proteção das rotas administrativas             | Estado da sessão e ações de entrar e sair                        |
| `teams`     | Equipes, seleção do contexto ativo, membros, níveis e convites                | Equipe ativa, permissões e operações administrativas autorizadas |
| `links`     | Criação, consulta, edição, desativação, arquivamento, restauração e histórico | Lista, detalhe e comandos de gestão de links permitidos          |
| `analytics` | Total e série diária agregada de cada link                                    | Consulta dos indicadores autorizados para o detalhe do link      |

Cada feature mantém regras e tipos em `model/`, integração com o backend em
`services/`, telas em `components/`, testes de comportamento em `tests/` e
expõe somente seu `index.ts`. As rotas administrativas, de convite e de
indisponibilidade são compostas em `app/routes/`. Uma feature que precisar de
outra usa apenas sua interface pública; detalhes internos não atravessam a
fronteira.

A inicialização do Firebase e clientes neutros ficam em infraestrutura
compartilhada sob `shared`, sem regras de equipe ou link. A configuração pública
é lida somente por `shared/config/env.ts`. Credenciais administrativas e outras
informações secretas existem apenas no ambiente do backend.

A fundação concreta está registrada na [ADR 0015](decisions/0015-firebase-foundation.md):
`src/shared/services/firebase` inicializa os SDKs Web sob demanda,
`functions/` isola o runtime Admin, e `firebase.json` mantém todos os emuladores
no projeto `demo-shortener`. As Rules começam fechadas e só serão abertas por
feature com testes positivos e negativos.

No backend, `functions/src/admin.ts` obtém especificamente o app Admin padrão e
inicializa-o quando necessário. A existência de um app nomeado pelo runtime não
é tratada como evidência de que `[DEFAULT]` já existe; todas as Functions que
acessam o Firestore usam essa fronteira compartilhada.

### Backend, dados e autorização

Firebase Authentication fornece login Google. Cloud Firestore persiste perfis
mínimos, equipes, associações, convites, links, histórico e analytics. Cloud
Functions concentra redirecionamento, consumo de convite e operações que exigem
coordenação ou atualização atômica. Firebase Security Rules protege qualquer
acesso direto permitido ao cliente.

A sessão segue a [ADR 0025](decisions/0025-google-authentication-popup.md) e a
[ADR 0026](decisions/0026-google-one-tap.md). O `AuthProvider` é montado em
`app/providers`, aguarda a primeira resposta do SDK e prepara o perfil antes
de liberar a árvore protegida. `/login` é pública e inicializa o Google One Tap
(quando configurado) com fallback para o botão com popup Google, `/app` é a
entrada administrativa e uma rota interna solicitada é preservada. Logout remove
a árvore privada imediatamente.

O backend é a fonte da verdade para autorização:

- administradores acessam membros, convites e todos os links da equipe;
- membros acessam e alteram somente os links que criaram;
- links continuam pertencendo à equipe após a saída do criador;
- o último administrador não pode sair, ser removido nem rebaixado;
- convites são reutilizáveis até a data escolhida ou o cancelamento;
- identificadores são reservados atomicamente e são únicos em todo o sistema.

A base de equipes segue a [ADR 0017](decisions/0017-team-membership-and-active-context.md).
`createTeam` grava equipe e primeiro administrador em uma transação. O cliente
consulta somente associações com o próprio UID, busca individualmente as equipes
autorizadas e representa o contexto ativo em `/app/equipes/{teamId}/{secao}`.
`TeamWorkspace` mantém o seletor, o botão de nova equipe e as abas Links,
Membros e Convites ao redor das rotas filhas; Links é a seção padrão e Convites
só aparece para administradores. A criação acontece em um `Dialog` tanto no
estado vazio quanto no workspace. O `TeamsProvider` descarta a geração do
contexto no logout; manipular a URL não amplia acesso.

A gestão de membros segue a
[ADR 0018](decisions/0018-membership-permissions-and-admin-continuity.md).
`MembersProvider` acompanha apenas a lista da equipe ativa e chama
`updateMembership` para promover, rebaixar, remover ou sair. A Function lê ator,
alvo e administradores na mesma transação; se uma alteração reduziria o total a
zero, responde com `last-admin`. A remoção apaga somente a associação, de modo
que links continuam vinculados à equipe e preservam `createdBy` para auditoria.

| Capacidade                         | Administrador | Membro |
| ---------------------------------- | ------------- | ------ |
| Ver equipe e lista de membros      | sim           | sim    |
| Promover, rebaixar ou remover      | sim           | não    |
| Sair da equipe                     | sim\*         | sim    |
| Gerenciar qualquer link da equipe  | sim           | não    |
| Gerenciar apenas os próprios links | sim           | sim    |

\* O último administrador precisa promover outra pessoa antes de sair. Controles
da interface espelham essa matriz, mas Rules e Functions aplicam a autorização.
Se uma associação for removida enquanto a tela está aberta, o listener perde a
leitura e a interface substitui imediatamente os dados por um estado genérico.

Controles ocultos na interface são apenas feedback de experiência e não
substituem Rules ou Functions. Tokens de convite concedem entrada enquanto
válidos e, por isso, são tratados como dados sensíveis, não aparecem em
listagens públicas e podem ser cancelados pelo administrador.

Convites seguem a [ADR 0019](decisions/0019-reusable-invite-tokens.md). O backend
gera 256 bits aleatórios e persiste apenas o SHA-256 em `inviteTokens/{hash}`.
`createInvite` e `cancelInvite` revalidam o administrador; `consumeInvite`
calcula o hash, usa o relógio do servidor e cria a associação `member` em
transação. `/invite/:token` exige login, mas a rota completa é preservada durante
o popup Google. A listagem mostra apenas metadados e o segredo completo
existe no cliente somente na resposta imediata da criação.

Links seguem a [ADR 0020](decisions/0020-global-link-slugs.md). `createLink`
normaliza o slug, valida um destino HTTP/HTTPS e confirma a associação da equipe
na mesma transação que reserva `links/{slug}` e cria o primeiro registro de
histórico. As Rules permitem ao administrador consultar `teamId` inteiro e
exigem de membros os filtros `teamId` e `createdBy`; o cliente nunca grava a
coleção diretamente.

O ciclo de vida segue a
[ADR 0021](decisions/0021-link-lifecycle-and-history.md). Destino e estado são
alterados por Functions transacionais que autorizam criador ou administrador e
acrescentam um evento somente quando há mudança real. `active`, `disabled` e
`archived` preservam slug, autoria, cliques e datas originais; restaurar volta a
`active`. O histórico é imutável, retido pela vida do link e lido em páginas de
dez eventos ordenados por timestamp do servidor e ID.

O redirecionamento público segue a
[ADR 0022](decisions/0022-public-redirect-and-aggregate-clicks.md). A Function
lê estado e destino e incrementa `totalClicks` e o documento do dia UTC na
mesma transação. Somente depois responde `302`; falha de leitura ou escrita não
redireciona. Links inexistentes, desativados e arquivados compartilham o mesmo
conteúdo indisponível e não geram contagem.

A leitura dos agregados segue a
[ADR 0023](decisions/0023-authorized-aggregate-analytics.md). A feature
`analytics` consulta até 30 documentos diários autorizados e preenche os dias
UTC sem registro com zero. O detalhe de `links` consome apenas sua interface
pública e mantém edição, total e histórico disponíveis em falha parcial.

### Fluxos de dados

1. No login, o cliente recebe a sessão do Firebase Authentication e recupera as
   equipes autorizadas no Firestore.
2. Ao consumir um convite, uma Function valida sessão, token, validade e estado
   antes de criar a associação de membro.
3. Ao criar um link, o backend valida destino e identificador e reserva o nome
   global em uma operação atômica; conflitos não produzem gravação parcial.
4. Alterações de destino ou estado atualizam o link e acrescentam um registro
   imutável com autor, data, valor anterior e valor novo.
5. No acesso público, a Function resolve o identificador, confirma que o link
   está ativo, incrementa o total e o contador do dia UTC e inicia o
   redirecionamento. Se qualquer verificação falhar, não conta clique nem revela
   dados internos.
6. O detalhe administrativo lê apenas o total e os agregados diários. Não há
   evento individual, IP, identidade, localização, dispositivo nem origem do
   visitante.

O identificador aceita de 3 a 50 letras minúsculas, números ou hífens e é
comparado sem diferença de caixa. Destinos `http://` e `https://` são aceitos.
Links não expiram automaticamente. Arquivamento preserva dados e mantém o
identificador reservado; restauração reativa o mesmo endereço. Alterar o destino
não reinicia analytics.

### Estado e interfaces

Não será adicionado gerenciador global de estado por padrão. Sessão e equipe
ativa podem usar providers de composição em `app`; dados e estados de
carregamento, vazio, sucesso e erro permanecem nos limites das features. Escrita
remota só confirma sucesso após persistência. Conflitos e falhas mantêm o dado
anterior e oferecem nova tentativa quando segura.

`TeamsProvider` é o provider de composição concreto para a equipe ativa. Ele
cobre `idle`, `loading`, `empty`, `ready` e `error`, e não persiste a última
seleção no navegador. A rota é o estado navegável da seleção, enquanto a lista
retornada pelo backend continua sendo a fonte para aceitar ou recusar o contexto.

As telas usam o kit de `@vitru/styleguide`, preservam a rota `/styleguide` e
atendem teclado, foco visível, rótulos e mensagens associadas. O dashboard cobre
equipe vazia, lista autorizada, erro e carregamento. Detalhes cobrem ausência de
cliques, histórico, falha e acesso negado. A página pública de indisponibilidade
é acessível e não depende de sessão.

### Distribuição, operação e trade-offs

A SPA e o domínio curto são publicados no Firebase Hosting; Firestore, Cloud
Functions e Authentication formam o backend. O redirecionamento deve começar em
até 1 segundo em condições normais. Chrome, Edge, Firefox e Safari atuais são os
navegadores atendidos.

A ordem do Hosting preserva a API de saúde, raiz, login, styleguide, dashboard e
convites antes da rota pública de um segmento. Arquivos estáticos existentes são
servidos antes dos rewrites. A medição local aquecida e o procedimento para
repeti-la no piloto estão em [redirect-performance.md](redirect-performance.md).

Produção usa `southamerica-east1` tanto no Firestore quanto nas Functions. A
região é explícita no backend, cliente e rewrites, e cada Function tem limites
de memória, timeout, concorrência e instâncias. Os guardrails completos estão na
[ADR 0024](decisions/0024-production-region-and-pilot-guardrails.md).

O produto excede deliberadamente o limite inicial do template, que não inclui
autenticação real nem backend. Essa ampliação foi aprovada porque equipes,
permissões, redirecionamento público e analytics compartilhados não podem ser
atendidos por armazenamento somente no navegador. O custo é maior dependência
do Firebase, configuração operacional e necessidade de regras e testes de
segurança.

Convites reutilizáveis simplificam a entrada de uma equipe, mas podem ser
repassados; validade e cancelamento são as medidas de contenção aprovadas.
Aceitar destinos HTTP preserva compatibilidade, embora não garanta transporte
seguro no destino. Analytics agregados reduzem custo e exposição de dados em
troca de não oferecer visitantes únicos ou segmentação. Arquivamento em vez de
exclusão definitiva preserva auditoria e evita que um endereço antigo seja
reassociado a outro conteúdo.

## Árvore de pastas

```
src/
├── app/          # composição geral: providers, rotas, layout — sem regra de negócio
│   ├── components/  # telas de erro e não encontrado usadas pelas rotas
│   ├── routes/      # definição das rotas e o router
│   └── tests/       # smoke test da composição
├── features/     # auth, teams, links e analytics em pastas independentes
├── shared/       # reutilizável e neutro: config, hooks, lib, types
├── test/         # setup.ts e render.tsx (utilidades de teste)
└── main.tsx      # ponto de entrada da aplicação
```

Uma feature típica:

```
features/minha-feature/
├── components/   # componentes de tela desta feature
├── model/        # tipos e lógica de negócio
├── services/     # acesso a APIs e persistência
├── tests/        # testes desta feature
└── index.ts      # interface pública da feature
```

## Responsabilidades

- **app/**: monta a aplicação. Providers, rotas e layout. Não contém regra de negócio.
- **features/**: cada capacidade do produto (ex.: "cadastro de clientes"). Reúne tudo que aquela funcionalidade precisa.
- **shared/**: peças reutilizáveis e neutras (botões, hooks genéricos, utilitários, estilos, tipos). Não conhece nenhuma feature específica.
- **test/**: configuração e utilitários compartilhados de teste.

## Regras de dependência

1. Cada funcionalidade tem sua própria pasta em `features/`.
2. Uma feature não importa arquivos internos de outra feature.
3. Uma feature expõe sua interface pública pelo `index.ts`.
4. Chamadas HTTP ficam em serviços/clientes, não nos componentes.
5. Acesso a `localStorage` fica em adaptadores/repositórios.
6. Componentes de apresentação não conhecem detalhes de persistência.
7. `shared` é neutro: não depende de nenhuma feature.
8. Não crie abstrações sem necessidade concreta.
9. Sem gerenciador global de estado por padrão.
10. Sem biblioteca de requisições se `fetch` já resolve.
11. Nenhuma credencial no código.
12. Estados de tela explícitos: carregando, vazio, sucesso e erro.
13. Toda mudança de comportamento considera os testes.
14. Toda decisão relevante atualiza a documentação ou gera um ADR.
15. Imports externos usam apenas o `index.ts` da feature; `npm run check:architecture` verifica essa fronteira.
16. `fetch` e armazenamento do navegador só aparecem em `services/`,
    `adapters/` ou `repositories/`, dentro de uma feature ou de `shared`.
17. `import.meta.env` só aparece em `shared/config/env.ts`.

## Acesso a APIs

Todo acesso a APIs passa por `services/`, `adapters/` ou `repositories/` dentro
da feature. Uma infraestrutura neutra e realmente compartilhada pode usar as
mesmas pastas dentro de `shared`. Os componentes chamam essa fronteira; nunca
fazem `fetch` diretamente. Isso concentra o tratamento de erros e facilita
substituir a fonte por dados fake nos testes. Veja [integrations.md](integrations.md).

## Armazenamento

Persistência local (ex.: `localStorage`) fica isolada em `services/`,
`adapters/` ou `repositories/`. Dados lidos na fronteira são validados antes de
entrar no modelo. Para o Short Links, o Firestore é a persistência principal e
seu acesso segue a mesma separação por serviços. Falhas de leitura, conflito e
escrita têm códigos estáveis e são apresentadas pela interface; uma operação
nunca confirma sucesso antes da persistência terminar.

Novas versões do formato persistido devem ter migração explícita e teste do formato anterior. Nunca apague silenciosamente dados que não puderem ser interpretados.

## Rotas e falhas

As rotas ficam em `app/routes`, que exporta `routes` (a árvore, montável com `createMemoryRouter` nos testes) e `router` (o router de produção). Importe sempre de `react-router`.

A rota raiz registra um `errorElement`, então um erro de renderização no layout ou em qualquer rota filha vira uma tela de falha, nunca tela branca. Uma rota curinga (`path: '*'`) atende endereços desconhecidos dentro do layout — mantenha-a como último filho ao acrescentar rotas.

O `ErrorBoundary` de `@vitru/styleguide` não envolve o `<Outlet />`, para não sombrear o `errorElement`. Use-o para isolar um widget arriscado dentro de uma página.

## Configuração de ambiente

Toda leitura de `import.meta.env` passa por `shared/config/env.ts`. As variáveis são declaradas em `ImportMetaEnv` (`src/vite-env.d.ts`) e validadas no boot: ausência ou formato inválido falha imediatamente, nomeando a variável. Nada que chegue ao browser é secreto.

## Estilo e identidade visual

Estilização por CSS Modules ([ADR 0005](decisions/0005-css-modules.md)), com os
valores fornecidos por `@vitru/styleguide/tokens.css`
([ADR 0011](decisions/0011-design-tokens-and-styleguide.md)). Cor, tipografia,
espaçamento, raio, sombra e movimento vêm de tokens; nenhum CSS de componente
declara cor literal. Archivo vem do pacote; os arquivos licenciados da TheMix
ficam apenas no projeto consumidor, em `public/fonts/`
([ADR 0013](decisions/0013-official-fonts.md)). O tema padrão é `vitru`, aplicado pelo atributo
`data-theme` no `index.html`.

As telas são montadas com o kit de `@vitru/styleguide` (cabeçalho, blocos,
campos, tabela, avisos, modal e os estados de carregando, vazio e erro), que já
consome os tokens e traz a semântica de acessibilidade esperada
([ADR 0012](decisions/0012-component-kit-and-visual-guardrails.md)). O subpath
`@vitru/styleguide/showcase` renderiza tokens e kit em `/styleguide` e serve de
referência viva para pessoas e agentes. Ícones vêm de `lucide-react`. As regras
completas estão em [styleguide.md](styleguide.md) e `npm run check:styleguide`
avisa quando são quebradas.

## Estado

O estado é local aos componentes ou às features. Não usamos gerenciador global de estado por padrão. Se, no futuro, a complexidade justificar, a decisão deve ser registrada em um ADR.

## Testes

Os testes ficam colocalizados dentro da feature, na pasta `tests/`. Testam o
comportamento observável da funcionalidade. Os scripts de arquitetura usam a AST
do TypeScript para cobrir imports estáticos, reexports, imports dinâmicos e o uso
de `fetch`, `localStorage` e `import.meta.env` fora das fronteiras permitidas.
Detalhes em [testing.md](testing.md).

## Evolução incremental

O template começa simples de propósito. Adicione estrutura, bibliotecas ou camadas apenas quando um problema real aparecer, e registre a mudança em um ADR (`docs/decisions/`).
