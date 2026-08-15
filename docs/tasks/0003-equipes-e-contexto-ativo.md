# 0003 — Equipes e contexto ativo

**Status:** concluída em 2026-08-15  
**Dependências:** 0002  
**Rastreabilidade:** RF-02, RN-02, RN-03, CA-02

## Contexto e objetivo

Usuários autenticados precisam criar e participar de várias equipes e escolher
em qual delas trabalham. Esta tarefa estabelece a posse e o contexto que todas
as capacidades seguintes usarão.

## Requisitos

- Criador de uma equipe torna-se seu primeiro administrador atomicamente.
- Um usuário pode pertencer a várias equipes e alternar a equipe ativa.
- Dashboard cobre carregando, sem equipe, sucesso e erro.
- Nenhuma equipe não autorizada aparece por consulta direta ou manipulação de URL.
- Nome de equipe é obrigatório, aparado e limitado a 80 caracteres.

## Não escopo

- Convites, alteração de níveis e remoção de membros.
- Exclusão completa de equipe.
- Preferências avançadas por equipe.

## Suposições

- A equipe ativa é estado de composição, não um gerenciador global adicional.
- Persistência da última equipe no navegador é opcional e, se usada, fica em um
  adaptador; o backend continua sendo a fonte de autorização.

## Proposta de solução

Criar a feature `teams`, com callable Function transacional para criar equipe e
associação administrativa, consultas autorizadas das associações e provider
leve de equipe ativa consumido pelas rotas administrativas.

## Módulos e arquivos previstos

- `src/features/teams/{model,services,components,tests,index.ts}`.
- `src/app/providers/`, `src/app/routes/`, `src/test/render.tsx`.
- Functions de equipe e regras de `teams`/`members`.
- índices e testes no Firestore Emulator.

## Tarefas sequenciais

- [x] Definir modelos de equipe, associação e nível.
- [x] Criar Function transacional que grava equipe e primeiro administrador.
- [x] Implementar consulta apenas das equipes associadas ao UID autenticado.
- [x] Criar provider/seletor de equipe ativa sem expor detalhes Firestore.
- [x] Construir estado sem equipe com formulário de criação.
- [x] Construir dashboard base e troca de equipe.
- [x] Tratar nome inválido, conflito, falha e sessão expirada.
- [x] Testar múltiplas equipes, ausência, troca e acesso negado.
- [x] Atualizar rotas, E2E incremental e documentação.

## Riscos

- Equipe criada sem administrador por escrita parcial.
- Query permitir enumeração de equipes alheias.
- Estado ativo sobreviver indevidamente a logout ou remoção.

## Critérios de aceite

- [x] Criar equipe gera exatamente uma associação de administrador.
- [x] Usuário vê todas e somente suas equipes.
- [x] É possível alternar equipe e todos os dados visíveis acompanham o contexto.
- [x] Estado sem equipe orienta a criação sem parecer erro.
- [x] Acesso direto a equipe alheia é recusado por Rules/backend.
- [x] Fluxo é operável por teclado e `npm run validate` passa.

## Validação e documentação

- Testes de modelo, componente, Function transacional e Rules.
- E2E com usuário criando duas equipes e alternando entre elas.
- Atualizar modelo de dados, rotas e decisões de estado na arquitetura.
