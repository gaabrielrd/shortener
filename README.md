# Short Links

Aplicação web interna para equipes criarem links públicos curtos,
personalizados e acompanharem analytics simples de cliques. O projeto usa React,
TypeScript e Vite na interface e Firebase para autenticação e backend.

## Objetivo

Permitir que equipes publiquem endereços memoráveis, preservem o controle dos
links e acompanhem o volume de acessos sem identificar visitantes.

## Escopo da primeira versão

Inclui:

- Login com Google
- Equipes, convites reutilizáveis e níveis de administrador e membro
- Links personalizados com destinos HTTP ou HTTPS
- Redirecionamento público
- Total de cliques e evolução diária
- Histórico de alterações

## Fora da primeira versão

- Login por senha ou criação anônima
- Domínios personalizados por equipe
- Rastreamento de visitantes, dispositivo, localização ou origem
- Aplicativo nativo ou funcionamento offline
- Exclusão definitiva de equipes

O escopo completo e os critérios de aceite estão em
[docs/prd.md](docs/prd.md).

## Pré-requisitos

- Node.js 22.22.2 (o arquivo `.nvmrc` indica a versão; com `nvm`, rode `nvm use`)
- npm 10.6.0 (a versão exata declarada em `packageManager`)
- git
- Java 11 ou mais recente para o Firebase Emulator Suite
- Um agente de código (ex.: Claude Code)

## Criar um novo projeto a partir do template

1. Crie o repositório a partir deste template (botão "Use this template" no GitHub) ou copie a pasta.
2. Entre na pasta do projeto.
3. Rode a instalação e o setup:

```bash
npm install
npm run setup
```

O `npm run setup` separa o identificador técnico do nome exibido, personaliza descrição, organização, licença e repositório, pode remover somente a demonstração canônica `notes` sem tocar em outras features e sincroniza as skills dos agentes. Ele também reinicia o `tasks.md` para que o projeto novo não herde o backlog do template — use `--keep-tasks` se quiser preservá-lo. Antes de aplicar, use `npm run setup -- --name="meu-app" --dry-run`; execuções repetidas com os mesmos valores são idempotentes e uma falha restaura o estado anterior.

## Prompts Iniciais (Copie, Preencha e Cole no Agente)

Escolha o cenário que se encaixa no seu momento e cole no seu agente de IA.

**Cenário A — "Tenho uma ideia mas não sei o escopo"** _(fluxo completo)_

```text
Estou começando um projeto novo. Faça o seguinte:
1. Rode `npm install` e depois `npm run setup -- --name="[meu-app]" --display-name="[Meu App]" --description="[descreva aqui]" --remove-example`.
2. Depois, use a skill plan-app para conduzir uma entrevista curta comigo e definirmos juntos o escopo do produto.
```

**Cenário B — "Já sei o que quero, planeje a feature"**

```text
O produto já está definido em docs/prd.md. Use a skill plan-feature para planejar a funcionalidade: [descreva a funcionalidade aqui]. Quero revisar o plano antes da implementação.
```

**Cenário C — "O plano foi aprovado, implemente"**

```text
O plano foi aprovado. Use a skill implement-feature para executar. Garanta que `npm run validate` passe limpo ao concluir.
```

## Instalação

```bash
npm install --global npm@10.6.0
npm install
```

## Execução

```bash
npm run dev
```

O Vite mostra no terminal o endereço local (algo como `http://localhost:5173`).
Para testar o fluxo Google sem uma conta real, use `npm run test:e2e`; a suíte
inicia Auth, Firestore e Functions Emulator e percorre o popup, a criação de
equipes e links, a cópia do endereço, o isolamento por criador, o ciclo de vida
com histórico e a gestão de dois níveis de membro.

## Validação

Antes de considerar qualquer alteração pronta, rode:

```bash
npm run validate
```

Esse comando executa, em sequência: verificação das skills, arquitetura e documentação, formatação, lint, checagem de tipos, testes com limites de cobertura, bundle de produção e um smoke test HTTP do artefato. Se todos passarem, a alteração está saudável.

## Verificação automática

Além da validação local, o repositório traz portões automáticos:

| Onde                | O que roda                                               |
| ------------------- | -------------------------------------------------------- |
| `pre-commit`        | `lint-staged` (ESLint e Prettier nos arquivos alterados) |
| `commit-msg`        | Convenção da mensagem de commit                          |
| `pre-push`          | `typecheck` e `test:unit` (Vitest sem cobertura)         |
| CI (GitHub Actions) | `validate` em Node 22.22.2, auditoria e E2E no Chromium  |

O CI está em `.github/workflows/ci.yml`. Configure a branch principal para
exigir os checks **Validate** e **E2E (Chromium)** antes do merge. As
atualizações de dependência chegam por Dependabot (`.github/dependabot.yml`).

Se um hook falhar, corrija a causa antes de prosseguir. O CI repete os portões
completos e continua sendo a fonte da verdade para integração.

## Comandos

| Comando                                         | O que faz                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                                   | Sobe o servidor de desenvolvimento com recarga automática           |
| `npm run build`                                 | Gera a versão de produção                                           |
| `npm run lint`                                  | Verifica problemas de código com ESLint                             |
| `npm run check:architecture`                    | Impede imports que atravessam as fronteiras das features            |
| `npm run check:firebase-safety`                 | Impede testes fora do projeto demo e valida a matriz de segurança   |
| `npm run check:docs`                            | Valida links, comandos e referências da documentação                |
| `npm run check:toolchain`                       | Confere a versão do npm declarada pelo projeto                      |
| `npm run format`                                | Formata os arquivos com Prettier                                    |
| `npm run format:check`                          | Confere se os arquivos estão formatados                             |
| `npm run typecheck`                             | Verifica os tipos do TypeScript                                     |
| `npm run test`                                  | Roda testes de unidade, componente, arquitetura e setup             |
| `npm run test:unit`                             | Roda apenas os testes Vitest, sem cobertura                         |
| `npm run test:coverage`                         | Roda os testes Vitest aplicando os limites de cobertura             |
| `npm run test:setup`                            | Roda os testes black-box do setup e da arquitetura                  |
| `npm run test:functions`                        | Roda os testes unitários das Cloud Functions                        |
| `npm run test:auth-emulator`                    | Valida sessão local e logout no Auth Emulator                       |
| `npm run test:rules`                            | Valida as Firestore Rules no emulador                               |
| `npm run test:members-emulator`                 | Valida concorrência administrativa e posse dos links                |
| `npm run test:invites-emulator`                 | Valida reutilização, expiração e cancelamento de convites           |
| `npm run test:links-emulator`                   | Valida links, ciclo de vida e contadores concorrentes               |
| `npm run test:firebase:smoke`                   | Valida Functions e rewrites através do Hosting Emulator             |
| `npm run test:firebase`                         | Valida toda a pilha Firebase demo em uma única sessão               |
| `npm run firebase:emulators`                    | Inicia Auth, Firestore, Functions e Hosting locais                  |
| `npm run test:e2e`                              | Executa o fluxo crítico no Chromium com Playwright                  |
| `npm run test:e2e:update`                       | Regera as imagens de referência do styleguide                       |
| `npm run test:watch`                            | Roda os testes em modo contínuo                                     |
| `npm run setup`                                 | Personaliza identificadores, apresentação e demonstração do projeto |
| `npm run update:template`                       | Aplica migrações locais conhecidas do template                      |
| `npm run generate:feature -- --name="clientes"` | Gera a estrutura inicial de uma feature                             |
| `npm run smoke:build`                           | Serve e verifica o conteúdo gerado em `dist/`                       |
| `npm run sync:skills`                           | Gera as cópias das skills em `.claude/skills` e `.agents/skills`    |
| `npm run check:skills`                          | Verifica se as cópias das skills estão sincronizadas                |
| `npm run check:styleguide`                      | Avisa sobre cor literal, token ausente ou ícone fora do padrão      |
| `npm run validate`                              | Roda skills, arquitetura, formato, lint, tipos, testes e bundle     |

## Estrutura resumida

```
src/
├── app/          # composição geral (providers, rotas, layout) — sem regra de negócio
├── features/     # cada capacidade do produto em sua pasta
├── shared/       # reutilizável e neutro (config, hooks, lib, types)
├── test/         # setup.ts e render.tsx
└── main.tsx
docs/             # esta documentação
```

Detalhes em [docs/architecture.md](docs/architecture.md).

Provisionamento, deploy, smoke, rollback, orçamento e métricas do piloto estão
no [runbook de operação](docs/operations.md). A autorização executável está na
[matriz de segurança](docs/security-matrix.md).

## Styleguide

O template consome `@vitru/styleguide`, pacote que concentra tokens, tema
`vitru`, Archivo, componentes e a referência visual. TheMix permanece local ao
projeto consumidor em `public/fonts`, sem ser redistribuída pelo pacote. Rode
`npm run dev` e abra `/styleguide` para ver a referência viva.

Essas regras continuam valendo depois do `npm run setup`. Leia
[docs/styleguide.md](docs/styleguide.md) antes de criar telas; `npm run check:styleguide`
avisa quando algo sai do padrão.

## Como usar agentes

As regras que os agentes devem seguir ficam em dois arquivos na raiz:

- `AGENTS.md` — regras gerais válidas para qualquer agente
- `CLAUDE.md` — instruções específicas para o Claude Code

Além disso, há skills que guiam tarefas comuns. Veja [docs/agents.md](docs/agents.md) para a lista e para exemplos de como acioná-las.

## Como criar uma feature

Se a ideia do aplicativo ainda não tem escopo fechado, comece com: "Use a skill plan-app para me ajudar a definir este produto". A skill conduz a conversa em linguagem simples, cria `docs/prd.md` após sua aprovação e registra as decisões em `docs/architecture.md`.

Depois que o produto estiver definido:

1. Peça ao agente um plano: "Use a skill plan-feature para planejar..."
2. Revise o plano.
3. Peça a implementação: "Use a skill implement-feature...".
4. Gere a base com `npm run generate:feature -- --name="minha-feature"`; use `--dry-run` para apenas listar os arquivos. O gerador cria `components` (com CSS Module já baseado nos tokens), `model`, `services`, `tests` e o `index.ts` público, mas não registra a feature na composição da aplicação.
5. Rode `npm run validate`.

Regras de arquitetura em [docs/architecture.md](docs/architecture.md); regras visuais em [docs/styleguide.md](docs/styleguide.md).

## Como registrar uma decisão

Decisões relevantes de arquitetura ou tecnologia viram um ADR (Architecture Decision Record) em `docs/decisions/`. Use o formato do primeiro registro, [0001-initial-architecture.md](docs/decisions/0001-initial-architecture.md), como modelo.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha os valores. Só variáveis com o prefixo `VITE_` chegam ao front-end, e **tudo que chega ao front-end é público** — nunca coloque segredos ali.

A leitura fica concentrada em [src/shared/config/env.ts](src/shared/config/env.ts): declare a variável em `ImportMetaEnv` (`src/vite-env.d.ts`) e, se ela for obrigatória, acrescente a chave em `REQUIRED_KEYS`. Assim uma configuração ausente ou malformada falha no boot, com mensagem dizendo qual variável corrigir, em vez de virar `undefined` em algum ponto distante do código.

Os valores reais deste ambiente ficam em `.env.local`, que é ignorado pelo Git.
Use `VITE_FIREBASE_USE_EMULATORS=true` durante o desenvolvimento contra
`demo-shortener`. A configuração Web é pública; segredos pertencem somente ao
ambiente das Functions.
Defina `VITE_PUBLIC_SHORT_BASE_URL` com a origem pública HTTP/HTTPS do domínio
curto; ela é usada para prévia e cópia dos endereços.

No Firebase Console do projeto real, habilite somente o provedor Google em
Authentication e adicione o domínio publicado à lista de domínios autorizados.

## Limitações conhecidas

- Login Google, equipes, membros, convites, links, histórico, redirecionamento e
  analytics agregados dos últimos 30 dias UTC estão implementados.
- O dashboard depende de conexão; não há modo offline.
- Analytics são agregados e não identificam nem segmentam visitantes.
- Sem gerenciador global de estado por padrão.
- Não é um sistema de alta criticidade.
