# 0006 — Criação e listagem de links

**Status:** concluída em 2026-08-15  
**Dependências:** 0005  
**Rastreabilidade:** RF-05, RF-06, RN-08, RN-09, RN-10, CA-05, CA-06

## Contexto e objetivo

Esta tarefa entrega a primeira capacidade central: criar um endereço curto
personalizado, copiá-lo e consultar os links permitidos na equipe ativa.

## Requisitos

- Destino absoluto iniciado por `http://` ou `https://`.
- Slug obrigatório com 3–50 letras minúsculas, números ou hífens.
- Comparação sem diferença de caixa e unicidade global atômica.
- Rotas do sistema e assets nunca podem virar slug.
- Administrador lista todos os links da equipe; membro, somente os próprios.
- Dashboard cobre carregamento, vazio, sucesso, erro e cópia do endereço.

## Não escopo

- Slug automático, edição, desativação, arquivamento ou analytics.
- Busca textual; o primeiro filtro necessário será por estado na tarefa 0007.
- Prévia ou inspeção do conteúdo do destino.

## Suposições

- Slug normalizado será a identidade imutável do documento do link.
- A base pública do endereço vem de configuração validada, não de `window.location`
  espalhado pelos componentes.

## Proposta de solução

Criar a feature `links` com validação de modelo compartilhada por contrato,
callable Function de criação e consultas autorizadas. A Function cria link e
primeiro item de histórico na mesma operação, recusando slug já existente ou
reservado.

## Módulos e arquivos previstos

- `src/features/links/{model,services,components,tests,index.ts}`.
- Function de criação, Rules e índices para equipe/criador/estado.
- dashboard/rotas e configuração `VITE_PUBLIC_SHORT_BASE_URL`.
- testes de modelo, componente, Functions e Rules.

## Tarefas sequenciais

- [x] Definir normalização, expressão válida e lista central de slugs reservados.
- [x] Validar URL absoluta HTTP/HTTPS sem fazer requisição ao destino.
- [x] Implementar criação atômica com autoria, equipe, timestamps e histórico.
- [x] Implementar consultas diferentes para administrador e membro.
- [x] Criar formulário com erros ligados aos campos e estado de salvamento.
- [x] Criar lista responsiva com destino, slug, estado, criador e ação de copiar.
- [x] Cobrir conflito concorrente de slug, caixa, rota reservada e URL inválida.
- [x] Cobrir estados carregando/vazio/erro/sucesso e negação de acesso.
- [x] Atualizar rotas, E2E incremental e documentação.

## Riscos

- Validação cliente/backend divergir.
- Duas equipes criarem o mesmo slug simultaneamente.
- URL permitir protocolo perigoso ou formato relativo.
- Tabela perder ações ou exigir rolagem horizontal em celular.

## Critérios de aceite

- [x] Slug válido e disponível produz endereço público copiável.
- [x] Colisão, rota reservada, formato inválido e destino inválido são recusados.
- [x] Administrador vê todos os links da equipe e membro apenas os próprios.
- [x] Usuário não lê nem cria link em equipe sem associação.
- [x] Lista e formulário funcionam por teclado e em telas pequenas.
- [x] Rules/Functions, componentes e `npm run validate` passam.

## Validação e documentação

- Testes de tabela de casos para slug/URL e concorrência no Emulator Suite.
- E2E de criação, cópia e isolamento entre dois membros.
- Atualizar lista de rotas reservadas, índices e variáveis públicas.
