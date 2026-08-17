# ADR 0017: associação de equipe e contexto ativo

## Status

Aceita.

## Contexto

Uma pessoa pode participar de várias equipes, mas toda capacidade administrativa
precisa operar em exatamente um contexto autorizado. A criação inicial também
não pode deixar uma equipe sem administrador por falha parcial.

## Decisão

- Criar `teams/{teamId}` e `teams/{teamId}/members/{uid}` na mesma transação da
  callable Function `createTeam`. A primeira associação sempre usa `admin`.
- Persistir `id` na equipe e `uid` e `teamId` na associação. Esses campos
  permitem validar o contrato recebido e consultar as associações próprias por
  `collectionGroup('members')` com filtro de UID.
- Declarar em `firestore.indexes.json` o índice ascendente de `members.uid` com
  escopo de collection group, necessário para a consulta filtrada em produção.
- Permitir pelo cliente somente a leitura de associações cujo `uid` corresponde
  à sessão e a leitura individual de equipes para as quais existe associação.
  Toda escrita continua exclusiva das Functions.
- Manter o `TeamsProvider` dentro da composição da aplicação. Ele expõe apenas
  equipes autorizadas, equipe ativa e operações estáveis da feature; detalhes do
  Firestore não atravessam o `index.ts` público.
- Representar a equipe ativa na URL `/app/equipes/{teamId}/{secao}`. A rota sem
  seção abre Links por padrão; Membros e Convites preservam o mesmo contexto.
  Uma identificação ausente ou alheia mostra um estado genérico e nunca dados
  de outra equipe.
- Não persistir a seleção no navegador nesta versão. Ao sair, a geração da
  sessão é descartada; uma nova entrada aguarda uma nova consulta mesmo quando o
  UID é o mesmo.

## Consequências

- Criar uma equipe confirma a equipe e o primeiro administrador como uma única
  operação remota.
- A listagem não enumera a coleção de equipes; parte apenas das associações do
  usuário e busca cada documento autorizado.
- URLs podem ser compartilhadas internamente sem transformar o identificador da
  rota em autorização.
- A navegação entre Links, Membros e Convites mantém o cabeçalho e o seletor da
  equipe ativa; a aba Convites continua restrita a administradores.
- Membros, alteração de nível, saída e remoção continuam para a próxima task.
