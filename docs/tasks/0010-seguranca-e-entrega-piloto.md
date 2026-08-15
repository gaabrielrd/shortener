# 0010 — Segurança, qualidade e entrega piloto

**Status:** em andamento  
**Dependências:** 0001–0009  
**Rastreabilidade:** CA-01 a CA-15 e critérios de sucesso do PRD

## Contexto e objetivo

Os incrementos funcionais só formam a primeira versão quando autorização,
concorrência, acessibilidade, deploy e operação forem verificados como um fluxo
único. Esta tarefa endurece o sistema e prepara a equipe piloto.

## Requisitos

- Revisar Rules e Functions contra toda a matriz administrador/membro/visitante.
- Substituir o E2E herdado de notas pela jornada crítica do Short Links.
- Testes automatizados usam projeto `demo-` e nunca produção.
- Validar navegadores atuais, responsividade, teclado e estados de falha.
- Documentar criação do projeto Firebase real, região, Google Auth, índices,
  Hosting, domínio, deploy, rollback, logs, orçamento e smoke.
- Medir a meta de 20 links/primeiro mês sem guardar analytics de pessoas.

## Não escopo

- Nova funcionalidade de produto, painel operacional complexo ou SLA formal.
- Ambiente de staging obrigatório, domínio por equipe ou suporte 24x7.
- Redução de regras/testes para acelerar a entrega.

## Suposições

- O primeiro deploy usa um único projeto Firebase de produção e o domínio padrão
  até o domínio curto final ser informado.
- Alertas de orçamento e retenção de logs são configurados pela pessoa com acesso
  ao projeto, porque não são segredos versionáveis.

## Proposta de solução

Executar revisão de ameaça focada em autorização, tokens e URLs; completar a
pirâmide de testes com Emulator Suite e Playwright; criar runbook reproduzível;
publicar; rodar smoke autenticado e público; registrar evidências do piloto.

## Módulos e arquivos previstos

- `firestore.rules`, índices, Functions e respectivas suítes.
- `e2e/app.spec.ts`, Playwright, scripts npm e workflow de CI.
- `firebase.json`, documentação de desenvolvimento/deploy/operacão.
- PRD/arquitetura/ADR somente se a implementação exigir decisão nova aprovada.

## Tarefas sequenciais

- [x] Construir matriz executável de acessos permitidos/negados para todos os
      recursos e operações.
- [x] Testar concorrência de último administrador, slug, convite e cliques.
- [x] Revisar token de convite, validação de URL, logs, CORS, headers e limites
      das Functions; avaliar App Check/rate limiting sem bloquear redirect público.
- [x] Substituir o E2E de notas por login emulado, equipes, níveis, convite,
      criação, edição, estados, redirect, analytics e negações.
- [x] Adicionar casos de teclado, mobile e estados carregando/vazio/erro/sucesso.
- [x] Fazer CI iniciar Auth/Firestore/Functions/Hosting Emulator com projeto demo
      e falhar em qualquer tentativa de recurso real.
- [x] Criar runbook de provisionamento e deploy com pré-requisitos, índices,
      regras, Functions e Hosting em ordem segura.
- [ ] Configurar projeto real, provedor Google, região, domínio e alertas sem
      versionar credenciais.
- [ ] Executar `npm run validate`, E2E, deploy e smoke pós-deploy.
- [x] Registrar como medir 20 links e falha crítica ao fim do primeiro mês.

## Riscos

- Rules divergirem das Functions e criarem privilégio indevido.
- Teste E2E tocar produção ou depender de Google real.
- Deploy de rewrite interromper SPA ou links já publicados.
- Functions exigirem plano com faturamento e gerarem custo inesperado.
- Métrica do piloto ser contaminada por dados de teste.

## Critérios de aceite

- [x] Cada `CA-01`–`CA-15` possui teste observável ou evidência de smoke.
- [x] Rules negam leitura/escrita fora da matriz e mutações críticas só passam
      pelas Functions autorizadas.
- [x] E2E usa emuladores, não depende de Google/rede e cobre a jornada principal.
- [x] `npm run validate` e `npm run test:e2e` passam em ambiente limpo.
- [ ] Deploy de produção conclui com regras, índices, Functions e Hosting
      compatíveis; smoke autenticado e público passa.
- [x] Runbook contém rollback e nenhuma credencial foi versionada.
- [x] A equipe consegue medir 20 links no primeiro mês sem rastrear visitantes.

## Validação e documentação

- Guardar resultados de validate/E2E e checklist de smoke no PR de entrega.
- Revisar diff, dependências, Rules, índices, logs e console Firebase.
- Atualizar README, arquitetura, integrações, testes, build/deploy e manutenção.
