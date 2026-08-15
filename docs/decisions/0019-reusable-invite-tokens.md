# ADR 0019: tokens de convite reutilizáveis

## Status

Aceita.

## Contexto

Uma equipe precisa compartilhar um único convite com várias pessoas sem
vinculá-lo a e-mail. O endereço concede entrada enquanto estiver válido, então
o token não pode ser recuperável a partir do banco, de listagens ou de logs.

## Decisão

- Gerar 32 bytes com fonte criptográfica no backend e codificá-los em base64url.
  O endereço contém 43 caracteres opacos.
- Persistir `SHA-256(token)` como ID de `inviteTokens/{hash}`. O documento guarda
  somente equipe, criador, validade UTC, cancelamento, nível `member` e datas
  operacionais; o token em claro é retornado apenas na criação.
- Permitir leitura da coleção somente a administradores, filtrada por `teamId`,
  e negar toda escrita do cliente. Criação e cancelamento revalidam o nível na
  mesma transação da alteração.
- Fazer `consumeInvite` exigir sessão Google, calcular o hash, decidir validade
  pelo relógio do servidor e criar `teams/{teamId}/members/{uid}` em transação.
  Uma associação existente retorna sucesso idempotente.
- Distinguir na interface os estados ativo, vencido e cancelado, mas nunca
  incluir o token em listas, mensagens ou telemetria. O link completo fica em
  memória somente logo após a criação.
- Manter `/invite/:token` atrás de `ProtectedRoute`. A autenticação preserva a
  rota em `sessionStorage`, retorna ao token e só então executa o consumo.

## Consequências

- Perder o endereço recém-criado exige cancelar o convite e gerar outro; o
  segredo não pode ser recuperado do Firestore.
- Qualquer pessoa com o link e login Google pode entrar até a validade ou o
  cancelamento. A interface avisa o administrador desse risco.
- Cancelar bloqueia somente entradas futuras e não remove membros existentes.
- Não há limite de usos, vínculo por e-mail nem promoção automática para
  administrador na primeira versão.
