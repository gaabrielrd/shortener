# ADR 0015: fundação Firebase e contratos do backend

## Status

Aceita. Substitui somente a restrição “sem backend” da ADR 0001; as fronteiras
por feature e a simplicidade incremental continuam válidas.

## Contexto

Autenticação compartilhada, equipes, links públicos e contadores concorrentes
não cabem no armazenamento local do template. A primeira entrega precisa de uma
base reproduzível antes das regras de negócio, sem conectar testes ao projeto
real nem expor credenciais administrativas.

## Decisão

- Usar Firebase Web no navegador e Firebase Admin + Cloud Functions v2 no
  backend TypeScript. O runtime das Functions é Node 22.
- Manter o frontend e `functions/` em workspaces separados. Código do Admin SDK
  nunca é importado pelo bundle Vite.
- Inicializar Auth, Firestore e Functions sob demanda em
  `src/shared/services/firebase`. O SDK Analytics não será inicializado: os
  analytics do produto são agregados próprios de cliques e não telemetria de
  visitantes.
- Ler a configuração pública somente em `src/shared/config/env.ts`. Valores
  reais ficam em `.env.local`; segredos futuros ficam no ambiente do backend.
- Usar `demo-shortener` em todos os emuladores. Testes nunca usam o projeto
  Firebase real.
- Permitir leitura direta apenas quando Rules explicitamente autorizarem.
  Mutações coordenadas ou privilegiadas serão feitas por Functions.
- Começar com Rules fechadas: somente o perfil próprio pode ser lido e nenhuma
  escrita do cliente é aceita até a feature correspondente definir e testar a
  autorização.

## Modelo de dados

| Caminho                                 | Campos persistidos                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `users/{uid}`                           | `uid`, `displayName`, `email`, `createdAt`, `updatedAt`                                    |
| `teams/{teamId}`                        | `id`, `name`, `createdBy`, `createdAt`, `updatedAt`                                        |
| `teams/{teamId}/members/{uid}`          | `uid`, `teamId`, `role`, `displayName`, `email`, `joinedAt`                                |
| `inviteTokens/{tokenHash}`              | `teamId`, `createdBy`, `role`, `expiresAt`, `canceledAt`, `createdAt`                      |
| `links/{slug}`                          | `teamId`, `createdBy`, `destinationUrl`, `status`, `totalClicks`, `createdAt`, `updatedAt` |
| `links/{slug}/history/{entryId}`        | `action`, `actorId`, `previousValue`, `nextValue`, `createdAt`                             |
| `links/{slug}/dailyClicks/{YYYY-MM-DD}` | `dayUtc`, `count`, `updatedAt`                                                             |

O perfil e os futuros documentos de convite, link e dia UTC usam identificadores
semânticos. Equipes e associações repetem seus identificadores para validar a
resposta da Function e suportar a consulta `collectionGroup` autorizada. Timestamps
persistidos usam `Timestamp` do Admin SDK. Nenhum índice composto é necessário;
cada consulta futura deve adicionar seu índice junto da feature que a introduzir.
A feature de equipes adiciona o índice manual de collection group para
`members.uid`, conforme a ADR 0017.

Functions retornam códigos estáveis em sete famílias:
`auth/unauthenticated`, `auth/forbidden`, `validation/failed`,
`resource/conflict`, `resource/not-found`, `service/unavailable` e
`service/internal`. A resposta pode identificar um campo inválido, mas nunca
inclui stack trace ou detalhes internos.

A região das Functions e o domínio curto serão definidos antes do primeiro
deploy, considerando latência para o Brasil, disponibilidade e custo.

## Consequências

- Desenvolvimento e segurança podem ser exercitados localmente com Auth,
  Firestore, Functions e Hosting Emulator.
- Falta de configuração pública falha no boot com uma mensagem acionável.
- O projeto ganha dependência operacional do Firebase e Java para o Emulator
  Suite.
- Cada feature precisa abrir Rules e índices de forma mínima, acompanhada de
  teste permitido/negado.
