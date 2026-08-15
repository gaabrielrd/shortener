# Integrações e APIs

Como consumir dados externos com segurança neste template.

## Consumo de APIs

Todo acesso a uma API passa por `services/`, `adapters/` ou `repositories/`
dentro da feature. Infraestrutura neutra compartilhada pode usar as mesmas
pastas em `shared/`. Os componentes nunca fazem `fetch` diretamente. Isso
concentra a lógica de rede e o tratamento de erros em um só lugar.

`npm run check:architecture` rejeita `fetch` e `localStorage` fora dessas
fronteiras, além de rejeitar `import.meta.env` fora de
`shared/config/env.ts`. Arquivos de teste são excluídos dessas regras para que
possam preparar o ambiente e substituir APIs da plataforma.

Prefira o `fetch` nativo. Só adote uma biblioteca de requisições se houver necessidade real (e registre a decisão em um ADR).

## Variáveis de ambiente

- No Vite, apenas variáveis com prefixo `VITE_` são expostas ao código do cliente.
- Documente as variáveis necessárias em `.env.example`.
- Crie um `.env.local` para os valores do seu ambiente.
- **Nunca** faça commit de `.env` ou `.env.local`.

No Short Links, `.env.example` lista a configuração pública do Firebase Web,
`VITE_FIREBASE_USE_EMULATORS` e `VITE_PUBLIC_SHORT_BASE_URL`. A última variável
define a origem usada para copiar os endereços curtos. A validação central falha no boot se um campo
obrigatório estiver ausente. O adaptador lazy em
`src/shared/services/firebase` cria Auth, Firestore e Functions e aponta todos
para localhost quando a flag de emuladores está ativa.

## Segredos: proibido no front-end

Tudo que vai para o navegador entra no bundle e é **público**. Qualquer pessoa consegue ler. Por isso:

- Não coloque chaves de API secretas, senhas ou tokens no código nem em variáveis `VITE_`.
- Segredos existem somente no ambiente das Cloud Functions; nunca usam prefixo
  `VITE_` nem entram no repositório.
- A configuração Web fornecida pelo console Firebase identifica o app, mas não
  substitui Authentication, Security Rules ou autorização no backend.

## Firebase local

`npm run firebase:emulators` compila SPA e Functions e inicia Auth (9099),
Firestore (8080), Functions (5001), Hosting (5000) e a UI (4000), sempre com
`demo-shortener`. O projeto real não é necessário para testes locais. Regras e
contratos estão em `firestore.rules`, `firestore.indexes.json` e
`functions/src/contracts/`; detalhes em [ADR 0015](decisions/0015-firebase-foundation.md).

## Autenticação Google

Ative o provedor **Google** em Authentication > Sign-in method no projeto real
e autorize o domínio que hospedará a aplicação. Não habilite senha, conta
anônima ou outro provedor para o produto. O cliente usa popup acionado diretamente
pelo botão de entrada, sem navegar a SPA, e a Function
`ensureUserProfile` confirma novamente que o token veio de `google.com` antes
de persistir UID, nome, e-mail, `createdAt` e `updatedAt`.

`VITE_FIREBASE_AUTH_DOMAIN` pode manter o domínio `firebaseapp.com` fornecido
pelo Firebase. O popup evita a dependência de armazenamento entre origens do
fluxo por redirect; cancelamento, bloqueio do popup e falha de rede voltam para
a tela de entrada como erros recuperáveis.

No desenvolvimento e E2E, o widget do Auth Emulator cria uma identidade Google
falsa. Esses testes usam `demo-shortener` e não dependem de conta ou token real.

## Equipes

A callable Function `createTeam` valida a sessão Google e o nome, então grava
`teams/{teamId}` e `teams/{teamId}/members/{uid}` atomicamente. O cliente não
escreve nesses caminhos. Para listar os contextos disponíveis, a feature
`teams` consulta por `collectionGroup('members')` com `uid == request.auth.uid`
e lê individualmente somente as equipes autorizadas pelas Rules. Veja a
[ADR 0017](decisions/0017-team-membership-and-active-context.md).

Membros da equipe leem a subcoleção `members` diretamente, mas nunca escrevem
nela. Promoção, rebaixamento, remoção e saída passam pela callable
`updateMembership`, que valida o nível do ator e protege o último administrador
em transação. Uma associação removida perde leitura imediatamente; links não
são alterados porque pertencem ao `teamId`. Veja a
[ADR 0018](decisions/0018-membership-permissions-and-admin-continuity.md).

## Convites reutilizáveis

`createInvite` recebe `teamId` e uma validade ISO futura, gera um token aleatório
e retorna o endereço secreto uma única vez. O Firestore guarda somente o hash e
metadados em `inviteTokens`; administradores listam esses metadados por equipe e
cancelam pela Function `cancelInvite`. `consumeInvite` exige login Google,
decide expiração pelo relógio do servidor e cria uma associação `member` de
forma idempotente. Não registre o parâmetro de `/invite/:token` em logs,
analytics ou mensagens. Veja a
[ADR 0019](decisions/0019-reusable-invite-tokens.md).

## Links curtos

A callable `createLink` aceita `teamId`, slug e destino, mas repete toda a
validação no backend. O slug normalizado é o ID global em `links/{slug}` e o
link, junto do primeiro `history/{entryId}`, nasce em uma única transação. A
Function aceita membros e administradores associados; pessoas externas recebem
negação sem gravação parcial.

O cliente consulta `links` por equipe e data. Administradores recebem toda a
equipe; membros acrescentam `createdBy == uid`, condição exigida pelas Security
Rules. Escritas diretas são sempre negadas. Os índices necessários estão em
`firestore.indexes.json`; detalhes em
[ADR 0020](decisions/0020-global-link-slugs.md).

`updateLinkDestination` e `changeLinkStatus` leem associação e link na mesma
transação. Somente o criador ou um administrador pode alterar; repetições
idempotentes não geram evento. Mudanças reais atualizam o documento e criam um
registro imutável em `links/{slug}/history` com ator, data do servidor e valores
anterior/novo. A interface pagina dez eventos por vez. Veja a
[ADR 0021](decisions/0021-link-lifecycle-and-history.md).

### Redirecionamento público

O Firebase Hosting envia um slug de um único segmento para `redirectLink`, sem
exigir autenticação. A Function aceita `GET`, normaliza caixa, confirma estado
`active` e incrementa atomicamente o total e `dailyClicks/{dia UTC}` antes de
responder `302`. Destinos HTTP e HTTPS são preservados.

Todas as respostas públicas desabilitam cache duradouro e envio de referrer.
Inexistente, inválido, desativado e arquivado recebem o mesmo HTML e status
`404`. Uma falha de confirmação usa o mesmo HTML com `503`, nunca inclui
`Location` e não confirma o clique. Não há documento de evento ou dado do
visitante. O backend não cria logs por acesso; a operação usa somente métricas
agregadas de latência e erros da plataforma. Veja a
[ADR 0022](decisions/0022-public-redirect-and-aggregate-clicks.md).

## Analytics agregados

O detalhe lê `totalClicks` junto do link e consulta diretamente a subcoleção
`dailyClicks` apenas para os 30 dias UTC mais recentes. A query usa limites
inferior e superior em `dayUtc`, ordem crescente e `limit(30)`; dias sem
documento são completados com zero no modelo de apresentação.

As Rules repetem a matriz do histórico: criador consulta o próprio link e
administrador consulta qualquer link da equipe. Outro membro, pessoa externa ou
sessão sem Google não lê a série. O cliente nunca escreve contadores. Falha da
série não esconde o total já recebido nem bloqueia gestão e histórico. Veja a
[ADR 0023](decisions/0023-authorized-aggregate-analytics.md).

## CORS

APIs externas precisam permitir a origem do seu app (cabeçalhos CORS). Se aparecer erro de CORS no navegador, o ajuste é do lado do servidor da API; não há como contornar apenas no front-end.

## Tratamento de erros

No serviço, verifique se a resposta foi bem-sucedida e traduza falhas em erros claros para a interface. Na tela, trate os estados explicitamente: **carregando**, **vazio**, **sucesso** e **erro**.

## Timeouts

Requisições podem travar. Use um timeout (por exemplo, com `AbortController`) para não deixar a interface esperando indefinidamente, e mostre uma mensagem de erro quando o tempo estourar.

## Dados fake em desenvolvimento e testes

Para desenvolver ou testar sem depender de uma API real, use um adaptador com dados fake que respeite a mesma interface do serviço. Assim a tela funciona igual, e os testes ficam rápidos e previsíveis.
