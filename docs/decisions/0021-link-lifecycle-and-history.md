# ADR 0021: ciclo de vida transacional e histórico imutável

## Status

Aceita.

## Contexto

O destino e o estado de um link podem mudar sem que seu slug, analytics ou
autoria sejam perdidos. A auditoria precisa distinguir mudanças reais de
repetições idempotentes e continuar protegida quando o histórico crescer.

## Decisão

- Manter `links/{slug}` permanentemente reservado e sem operação de exclusão ou
  alteração do slug.
- Aplicar destino e estado pela Function em uma transação que lê link e
  associação, valida criador ou administrador, atualiza `updatedAt` e cria um
  único evento em `history/{entryId}`.
- Representar os estados `active`, `disabled` e `archived`. Desativar impede uso
  temporário, arquivar preserva o endereço e restaurar leva desativados ou
  arquivados de volta a `active`.
- Tratar comandos que já produziram o estado ou destino solicitado como sucesso
  idempotente, sem atualizar data nem criar histórico enganoso.
- Permitir leitura direta do histórico somente ao criador ou administrador,
  ordenada por timestamp do servidor e ID do documento, em páginas de dez
  eventos. Escritas e exclusões do cliente permanecem negadas.
- Reter o histórico pela vida do link. Não existe expiração automática ou
  exclusão definitiva na primeira versão.

## Consequências

- Link e evento nunca divergem por falha parcial; concorrência é serializada
  pelo Firestore.
- Arquivamento não reduz o namespace disponível e não transfere o endereço.
- A interface chama a ação destrutiva de “Arquivar”, confirma mudanças de
  estado e oferece restauração explícita.
- O histórico registra valores anteriores e novos, mas analytics acumulados não
  são separados por versão do destino.
