# Evidência da entrega piloto

## Gates locais

- [x] `npm run validate` — 102 Web, 37 Functions e 50 contratos
- [x] `npm run test:firebase` — 26 integrações e smoke, 72,2 ms aquecido
- [x] `npm run test:e2e` desktop e mobile — 3 passaram, 1 visual foi ignorado por plataforma
- [x] `npm audit --audit-level=high` — sem high/critical; 10 moderadas transitivas

## Produção

- [x] Google Auth habilitado e domínio Hosting autorizado — popup de produção
      abre o seletor Google e mantém a SPA em `/login`
- [ ] orçamento e alertas configurados — aguardando valor mensal aprovado
- [ ] App Check em monitoramento
- [x] Rules e índices publicados — deploy concluído em 15/08/2026
- [x] Functions publicadas em `southamerica-east1` — 11 funções Node.js 22 de
      segunda geração criadas em 15/08/2026
- [ ] política de limpeza do Artifact Registry — prazo de retenção depende de
      aprovação explícita; o Firebase sugere um dia por padrão
- [ ] Hosting publicado e smoke autenticado/público concluído — Hosting, cache
      seguro, smoke público e abertura do popup aprovados; jornada autenticada
      aguarda conclusão do login da conta de smoke
- [ ] latência quente e fria registradas em [redirect-performance.md](redirect-performance.md)

## Fechamento do primeiro mês

| Indicador                    | Baseline    | Resultado   | Meta |
| ---------------------------- | ----------- | ----------- | ---- |
| Links reais da equipe piloto | a registrar | a registrar | ≥ 20 |
| Falhas críticas              | 0           | a registrar | 0    |

Não registrar identidade, IP, origem, dispositivo ou localização de visitantes.
