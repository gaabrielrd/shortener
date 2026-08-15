# Matriz de segurança e critérios do piloto

Esta matriz liga cada critério aprovado a uma evidência automatizada. Todas as
suítes Firebase usam exclusivamente `demo-shortener`; a produção aparece apenas
no runbook e na configuração de deploy.

| Critério | Acesso e comportamento                         | Evidência executável                                                                                                             |
| -------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| CA-01    | Visitante não lê área administrativa           | [E2E de autenticação](../e2e/app.spec.ts) e [Rules](../tests/firebase/firestore.rules.test.mjs)                                  |
| CA-02    | Google cria equipe e vira administrador        | [E2E](../e2e/app.spec.ts) e [integração de equipes](../tests/firebase/members.emulator.test.mjs)                                 |
| CA-03    | Convite válido aceita pessoas distintas        | [integração de convites](../tests/firebase/invites.emulator.test.mjs)                                                            |
| CA-04    | Convite vencido ou cancelado é negado          | [integração de convites](../tests/firebase/invites.emulator.test.mjs)                                                            |
| CA-05    | Membro cria e copia link válido                | [fluxo web](../src/features/links/tests/links-flow.test.tsx) e [E2E](../e2e/app.spec.ts)                                         |
| CA-06    | Slug inválido, reservado ou usado é recusado   | [modelo](../src/features/links/tests/link-model.test.ts) e [concorrência](../tests/firebase/links.emulator.test.mjs)             |
| CA-07    | Link ativo conta e redireciona                 | [smoke Hosting](../scripts/firebase-emulator-smoke.mjs) e [E2E](../e2e/app.spec.ts)                                              |
| CA-08    | Estados indisponíveis têm resposta genérica    | [smoke Hosting](../scripts/firebase-emulator-smoke.mjs)                                                                          |
| CA-09    | Criador vê total, dias UTC e histórico         | [painel](../src/features/analytics/tests/AnalyticsPanel.test.tsx) e [E2E](../e2e/app.spec.ts)                                    |
| CA-10    | Membro não acessa link alheio                  | [Rules](../tests/firebase/firestore.rules.test.mjs) e [E2E](../e2e/app.spec.ts)                                                  |
| CA-11    | Administrador gerencia a equipe inteira        | [Rules](../tests/firebase/firestore.rules.test.mjs) e [E2E](../e2e/app.spec.ts)                                                  |
| CA-12    | Edição preserva slug e analytics               | [integração de links](../tests/firebase/links.emulator.test.mjs)                                                                 |
| CA-13    | Arquivado reserva slug e pode ser restaurado   | [integração de links](../tests/firebase/links.emulator.test.mjs) e [E2E](../e2e/app.spec.ts)                                     |
| CA-14    | Último administrador é protegido               | [concorrência de membros](../tests/firebase/members.emulator.test.mjs)                                                           |
| CA-15    | Jornada funciona em desktop, celular e teclado | [E2E desktop/mobile](../playwright.config.ts) e [testes de componentes](../src/features/analytics/tests/AnalyticsPanel.test.tsx) |

## Matriz de recursos

| Recurso          | Visitante              | Membro                 | Administrador          | Escrita do cliente       |
| ---------------- | ---------------------- | ---------------------- | ---------------------- | ------------------------ |
| Perfil próprio   | não                    | ler o próprio          | ler o próprio          | nunca                    |
| Equipe e membros | não                    | ler equipes associadas | ler equipes associadas | nunca                    |
| Convites         | não                    | não                    | listar da equipe       | nunca; somente Functions |
| Links            | somente redirect ativo | próprios               | todos da equipe        | nunca; somente Functions |
| Histórico        | não                    | dos próprios links     | todos da equipe        | nunca; somente Functions |
| Analytics diário | não                    | dos próprios links     | todos da equipe        | nunca; somente backend   |

As Functions repetem autorização e validade dentro de transações. Ocultar um
controle na interface nunca é a única barreira.
