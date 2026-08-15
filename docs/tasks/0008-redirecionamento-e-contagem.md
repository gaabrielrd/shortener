# 0008 — Redirecionamento público e contagem

**Status:** concluída  
**Dependências:** 0007  
**Rastreabilidade:** RF-09, RN-01, RN-14, CA-07, CA-08

## Contexto e objetivo

O endereço curto precisa funcionar sem login, respeitar o estado atual do link e
registrar somente agregados de cliques antes de redirecionar.

## Requisitos

- Um slug ativo responde publicamente com redirecionamento temporário ao destino.
- Cada resposta bem-sucedida incrementa total e dia UTC, inclusive repetições.
- Não persistir evento, IP, usuário, referrer, dispositivo ou localização.
- Inexistente, desativado ou arquivado mostra a mesma página “Link indisponível”.
- Falha ao confirmar link/contagem não redireciona nem confirma clique.
- Redirecionamento começa em até 1 segundo em condições normais medidas.

## Não escopo

- Visitante único, detecção de bot, UTM, preview, QR code ou cache permanente.
- Link expirável ou destino diferente por visitante.

## Suposições

- A resposta será `302` e evitará cache duradouro porque o destino pode mudar.
- Rewrites explícitos da SPA precedem o catch-all de slug; rotas reservadas não
  chegam à Function de redirecionamento.

## Proposta de solução

Criar HTTPS Function enxuta que normaliza o slug, lê o link, verifica estado,
atualiza contadores de forma atômica e responde `302`. Hosting serve assets e
rotas administrativas primeiro e direciona o restante à Function. A resposta
indisponível é genérica e acessível.

## Módulos e arquivos previstos

- Function HTTP de redirecionamento e módulo de contadores.
- `firebase.json` com ordem testada de rewrites.
- `links/{slug}` e `dailyClicks/{YYYY-MM-DD}`.
- página/HTML de indisponibilidade e testes Hosting/Functions Emulator.

## Tarefas sequenciais

- [x] Definir contrato HTTP, headers, normalização e página indisponível.
- [x] Implementar leitura e validação de estado sem exigir autenticação.
- [x] Implementar incremento atômico de total e dia UTC sem evento individual.
- [x] Responder `302` somente depois da operação bem-sucedida.
- [x] Configurar rewrites preservando raiz, login, convite, dashboard,
      styleguide e assets.
- [x] Testar destinos HTTP/HTTPS e todos os estados de link.
- [x] Testar concorrência de cliques sem perda de contagem.
- [x] Medir a latência local e registrar o procedimento da medição no ambiente
      publicado como gate da entrega piloto.
- [x] Atualizar observabilidade e documentação.

## Riscos

- Catch-all capturar rotas da SPA ou assets.
- Contenção em links com muitos acessos.
- Cold start impedir a meta de latência.
- Cache do navegador manter um destino antigo.
- Logs automáticos coletarem dados além do necessário; revisar campos emitidos.

## Critérios de aceite

- [x] Link ativo redireciona para o destino atual e incrementa total/dia uma vez.
- [x] Repetições contam separadamente sem criar documentos de visitante.
- [x] Link inválido, desativado ou arquivado mostra conteúdo genérico idêntico.
- [x] Rotas administrativas e assets não são tratados como slugs.
- [x] Concorrência não perde incrementos e a meta de latência tem evidência.
- [x] Testes de Functions/Hosting e `npm run validate` passam.

## Validação e documentação

- Testes HTTP no Emulator Suite, carga curta concorrente e smoke de Hosting.
- Verificar Firestore para confirmar somente total e agregados diários.
- Documentar headers, rewrites, métrica de desempenho e comportamento em falha.
