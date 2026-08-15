# 0001 — Fundação Firebase e contratos do backend

**Status:** concluída em 2026-08-15  
**Dependências:** nenhuma  
**Rastreabilidade:** integrações do PRD, RN-16

## Contexto e objetivo

O projeto ainda é somente uma SPA. Esta tarefa cria a base Firebase testável e
documenta contratos de dados e segurança antes das funcionalidades de negócio.

## Requisitos

- Alinhar Node/npm com as engines das dependências e do runtime de Functions.
- Adicionar somente os SDKs necessários: Firebase Web no cliente, Firebase Admin
  e Functions no backend e Firebase CLI para desenvolvimento/testes.
- Criar workspace TypeScript de Functions sem misturá-lo ao bundle Vite.
- Configurar Auth, Firestore, Functions e Hosting no Emulator Suite com um mesmo
  projeto `demo-`.
- Centralizar configuração pública em `src/shared/config/env.ts` e documentá-la
  em `.env.example`; nenhum segredo pode usar prefixo `VITE_`.
- Definir coleções, campos, timestamps, índices iniciais e contratos de erro.
- Criar regras Firestore fechadas por padrão e estrutura para testes de Rules.

## Não escopo

- Login, equipes, convites ou links funcionais.
- Projeto Firebase real, domínio final ou deploy de produção.
- Abstração genérica de banco ou suporte a outro provedor de nuvem.

## Suposições

- Functions de segunda geração e TypeScript serão usados.
- Região e projeto reais serão escolhidos antes do primeiro deploy; a preferência
  deve equilibrar suporte dos serviços, latência para o Brasil e custo.
- Leituras diretas autorizadas e mutações por Functions são o padrão inicial.

## Proposta de solução

Criar `functions/` como pacote isolado, `firebase.json`, regras e índices na
raiz, scripts explícitos para build e emuladores e um adaptador Firebase neutro
em `shared`. Registrar as escolhas em ADR e atualizar arquitetura, integrações,
build e testes.

## Módulos e arquivos previstos

- `package.json`, `package-lock.json`, `.nvmrc`, `.env.example`.
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`.
- `functions/package.json`, `functions/tsconfig.json`, `functions/src/`.
- `src/shared/config/`, `src/shared/services/firebase/`, `src/vite-env.d.ts`.
- testes de ambiente, Rules e smoke dos emuladores; novo ADR.

## Tarefas sequenciais

- [x] Fixar uma versão Node suportada localmente, no CI e por Functions; remover
      o aviso atual de engine do `jsdom`.
- [x] Registrar em ADR SDKs, região a confirmar, modelo de autorização e
      separação cliente/backend.
- [x] Instalar dependências com justificativa e lockfiles reproduzíveis.
- [x] Criar o pacote Functions com lint, typecheck, testes e build próprios.
- [x] Configurar Firebase Hosting, Auth, Firestore e Functions Emulator usando
      um projeto `demo-` consistente.
- [x] Modelar coleções e contratos TypeScript sem compartilhar código de runtime
      entre browser e Admin SDK.
- [x] Implementar inicialização do cliente, conexão opcional aos emuladores e
      validação de todas as variáveis públicas.
- [x] Criar Rules deny-by-default e um primeiro teste permitido/negado.
- [x] Integrar os novos gates ao `npm run validate` sem acessar rede ou produção.
- [x] Atualizar documentação de desenvolvimento, integrações, testes e deploy.

## Riscos

- Incompatibilidade entre runtime de Functions, Node local e matriz de CI.
- Configuração apontar acidentalmente testes para produção.
- Tipos compartilhados acoplarem SDK Web e Admin.
- Emulador Firestore exigir Java não documentado.

## Critérios de aceite

- [x] Um clone novo instala todos os pacotes sem ignorar engines.
- [x] Emuladores Auth, Firestore, Functions e Hosting iniciam com o projeto demo.
- [x] Configuração ausente falha no boot com mensagem objetiva.
- [x] Rules negam acesso por padrão e possuem teste automatizado.
- [x] Nenhum ID real obrigatório ou segredo é versionado.
- [x] `npm run validate` passa e inclui o backend aplicável.

## Validação e documentação

- Executar testes de configuração e Rules, build de Functions e
  `npm run validate`.
- Revisar lockfiles, variáveis públicas, logs e diff.
- Atualizar ADR, `docs/architecture.md`, `docs/integrations.md`,
  `docs/testing.md` e `docs/building.md`.
