# ADR 0020: slugs globais e criação transacional de links

## Status

Aceita.

## Contexto

O endereço curto precisa ser fácil de lembrar, não pode colidir entre equipes e
deve preservar autoria e auditoria desde a criação. Uma validação apenas no
cliente ou uma consulta seguida de escrita deixaria duas reservas concorrentes
confirmarem o mesmo slug.

## Decisão

- Normalizar o slug com `trim` e caixa minúscula, aceitar de 3 a 50 letras
  ASCII, números ou hífens e impedir hífen nas pontas.
- Reservar rotas administrativas e técnicas (`app`, `login`, `invite`, `api`,
  `styleguide`, `assets` e equivalentes) antes de qualquer escrita.
- Usar o slug normalizado como ID imutável de `links/{slug}`. A coleção global
  torna a unicidade independente da equipe e a transação resolve concorrência.
- Fazer `createLink` validar sessão Google, associação de equipe e destino
  absoluto HTTP/HTTPS. A Function cria o link e o primeiro documento
  `history/{entryId}` na mesma transação.
- Negar escrita direta do cliente. Na leitura, administradores consultam todos
  os links filtrados pelo `teamId`; membros também precisam filtrar
  `createdBy == request.auth.uid`.
- Montar endereços copiáveis somente a partir de
  `VITE_PUBLIC_SHORT_BASE_URL`, validada no boot e sem depender da origem da
  tela administrativa.

## Consequências

- Um slug usado permanece uma identidade global e não pode ser transferido para
  outra equipe ou outro criador.
- A lista de rotas reservadas existe no modelo Web e no backend; os mesmos casos
  de contrato são testados nos dois runtimes.
- Consultas ordenadas exigem os índices de equipe, criador e estado declarados
  em `firestore.indexes.json`.
- O destino não é acessado nem inspecionado na criação; apenas seu formato e
  protocolo são validados.
