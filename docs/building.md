# Build & Deploy

O processo de build do template web é projetado para garantir que a aplicação possa ser entregue com confiabilidade, empacotando os assets de forma otimizada para produção.

## Comandos Principais

- `npm run build`: Roda o ciclo completo, incluindo tipos, Functions, Vite e smoke test.
- `npm run build:bundle`: Gera o bundle final via Vite (`vite build`).
- `npm run build:functions`: Compila o backend TypeScript em `functions/lib/`.
- `npm run firebase:emulators`: Compila e inicia a pilha Firebase local no
  projeto seguro `demo-shortener`.
- `npm run smoke:build`: Inicia um servidor efêmero e valida se os artefatos em `dist/` renderizam adequadamente no navegador.

## Variáveis de Ambiente

O Vite utiliza variáveis de ambiente com o prefixo `VITE_`. Copie
`.env.example` para `.env.local` e informe a configuração pública do app
Firebase Web.
Defina também `VITE_PUBLIC_SHORT_BASE_URL` com a origem HTTP/HTTPS que servirá os
endereços curtos públicos.

- Durante o desenvolvimento, o Vite lê de arquivos `.env`, `.env.local`, etc.
- No CI, o workflow fornece valores seguros do projeto `demo-shortener`; em uma
  entrega real, as variáveis do app alvo devem ser passadas no build para serem
  injetadas estaticamente pelo Vite.

Variáveis ausentes ou malformadas falham no boot da aplicação, com mensagem nomeando a variável — a validação fica em `src/shared/config/env.ts`. Isso vale também para o bundle de produção.

## Runtime e deploy

Desenvolvimento e CI usam Node 22.22.2 como versão de referência; Cloud
Functions declara runtime Node 22. O Emulator Suite também exige Java 11 ou
mais recente. Firestore, Functions, cliente e rewrites usam
`southamerica-east1`; a escolha e os limites estão na
[ADR 0024](decisions/0024-production-region-and-pilot-guardrails.md). O deploy e
rollback reproduzíveis estão no [runbook](operations.md).

## Integração contínua

O workflow `.github/workflows/ci.yml` roda `npm ci` e `npm run validate` em Node
22.22.2 a cada Pull Request, audita as dependências com
`npm audit --audit-level=high` e executa o fluxo crítico no Chromium em jobs
separados. Configure a branch principal para exigir os checks **Validate** e
**E2E (Chromium)** antes do merge.

Todos os jobs leem `packageManager` do `package.json`, instalam essa versão exata
do npm e executam `npm run check:toolchain` antes de `npm ci`. Assim todos usam
o mesmo resolvedor e a mesma interpretação do lockfile. Ao atualizar a
toolchain, altere em conjunto `packageManager`, `.nvmrc`, `engines`, a matriz do
CI e `package-lock.json`.

## Smoke Test

O script `scripts/smoke-build.mjs` serve como um sanity check após o build. Ele sobe o bundle resultante (`dist/`) localmente, faz uma requisição para a raiz e verifica se o conteúdo base (como as tags do React ou conteúdo estático esperado) estão presentes. Se o smoke test falhar, a pipeline quebra, impedindo o deploy de um pacote com erro fatal.

O smoke HTTP não executa JavaScript. O comando `npm run test:e2e` complementa
essa verificação iniciando o bundle em porta efêmera e exercitando o fluxo
principal no Chromium.
