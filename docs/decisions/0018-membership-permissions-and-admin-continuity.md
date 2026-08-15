# ADR 0018: permissões de membros e continuidade administrativa

## Status

Aceita.

## Contexto

Administradores precisam promover, rebaixar e remover pessoas, enquanto membros
comuns apenas consultam a composição da equipe e administram seus próprios
links. Operações simultâneas não podem deixar uma equipe sem administrador, e a
remoção de uma pessoa deve revogar o acesso sem transferir ou apagar os links
que ela criou para a equipe.

## Decisão

- Expor uma única callable Function `updateMembership` para mudança de nível,
  remoção e saída. O comando sempre inclui a equipe e o backend deriva o alvo da
  própria sessão na saída.
- Exigir sessão Google e associação válida em toda operação. Somente
  administradores promovem, rebaixam ou removem; qualquer membro pode solicitar
  a própria saída.
- Executar a leitura do ator, do alvo e da consulta de administradores na mesma
  transação. Toda redução do conjunto de administradores falha com
  `last-admin` quando restaria zero, inclusive depois de retries causados por
  concorrência.
- Negar toda escrita de associação no cliente. As Rules permitem a cada membro
  Google listar somente `teams/{teamId}/members` das equipes às quais ainda
  pertence.
- Manter links em `links/{slug}` com `teamId` e `createdBy`. Remover a associação
  não edita nem apaga esses documentos: a equipe continua sendo a proprietária.
- Tratar uma revogação observada no listener como “Equipe não disponível” e
  remover a lista da tela, mesmo que o provider de equipes ainda tenha um nome
  em memória.

## Consequências

- A interface oferece ações administrativas conforme o nível para orientar a
  pessoa, mas a autorização efetiva continua no backend.
- Duas reduções concorrentes podem disputar a transação; no máximo uma deixa de
  ser administradora quando havia exatamente duas.
- O documento de membro guarda nome e e-mail mínimos para exibir a lista sem
  liberar leitura global de perfis.
- Convites serão a única forma normal de adicionar membros e permanecem para a
  task 0005.
