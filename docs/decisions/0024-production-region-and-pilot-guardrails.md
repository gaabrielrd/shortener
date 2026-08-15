# ADR 0024: região de produção e guardrails do piloto

## Status

Aceita.

## Decisão

- Usar `southamerica-east1` para Firestore e todas as Functions. O banco real já
  existe nessa região e o público piloto está no Brasil.
- Fixar região no backend, cliente e rewrites; não depender do default
  `us-central1`.
- Definir timeout, memória, concorrência e `maxInstances` sem `minInstances` no
  piloto, equilibrando custo e cold start.
- Isolar automação em `demo-shortener`, verificando esse contrato no `validate`.
- Manter App Check em monitoramento antes de enforcement e não aplicá-lo ao
  redirect público.
- Publicar em ordem Rules/índices, Functions e Hosting, com rollback por camada.

## Consequências

- Functions e Firestore co-localizados evitam latência e tráfego inter-regional
  desnecessários.
- O primeiro acesso após inatividade pode sofrer cold start; métricas quentes e
  frias precisam ser registradas no smoke publicado.
- Limites de instância contêm custo, mas podem responder `429/5xx` sob abuso;
  orçamento e alertas são obrigatórios antes do piloto.
