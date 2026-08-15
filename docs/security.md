# Revisão de segurança do piloto

## Fronteiras e ameaças revisadas

- **Sessão:** somente tokens com `sign_in_provider == google.com` entram na área
  administrativa. Rules e callables repetem a verificação; a SPA não é uma
  fronteira de confiança.
- **Autorização:** associações em `teams/{teamId}/members/{uid}` definem acesso.
  Administrador gerencia a equipe; membro gerencia somente links com
  `createdBy == uid`. O último administrador é protegido em transação.
- **Convites:** o segredo tem 256 bits, aparece apenas na resposta de criação e
  o Firestore persiste somente SHA-256. Validade, cancelamento e associação são
  revalidados no servidor. Token não deve entrar em logs manuais.
- **URLs:** slug, equipe e destino têm tamanho/formato limitados. Destino aceita
  somente URL absoluta HTTP/HTTPS; o redirect usa o valor persistido e aplica
  `no-store`, `no-referrer`, CSP e `nosniff`.
- **Cliques:** somente agregados total/dia UTC são gravados. Não existe evento,
  IP, usuário, origem, dispositivo ou localização.
- **Concorrência:** equipe inicial, último administrador, convites, slug,
  histórico e cliques usam transações e possuem testes de disputa.
- **CORS e métodos:** callables usam o protocolo Firebase e exigem sessão. O
  redirect não habilita CORS, aceita apenas `GET` e não conta `POST`/`HEAD`.
- **Custo/abuso:** Functions têm timeout, memória, concorrência e máximo de
  instâncias explícitos. Isso limita explosão de custo, mas não substitui
  monitoramento de `429/5xx` e orçamento.

## App Check e limitação de taxa

App Check deve ser registrado no app Web e observado antes de enforcement nas
callables. O piloto começa sem enforcement para não bloquear usuários legítimos
sem evidência. O redirect público não exige App Check: fazê-lo quebraria links
abertos fora da SPA. Não há rate limit por IP porque isso criaria tratamento de
dado de visitante; abuso é contido por `maxInstances`, orçamento e resposta a
incidentes. Se carga real justificar outro mecanismo, a decisão precisa manter
o redirect público e revisar privacidade.

## Evidência

A [matriz CA-01–CA-15](security-matrix.md) aponta para os testes executáveis.
`npm run check:firebase-safety` impede identificadores de produção em código e
testes e exige `demo-shortener` em todo comando de emulador.

## Dependências

Em 15 de agosto de 2026, `npm audit --audit-level=high` não encontrou
vulnerabilidade high ou critical. Permanecem dez avisos moderados transitivos em
`firebase-tools`/`firebase-admin`. O reparo automático oferecido exige
`--force` e rebaixa o Firebase CLI de 15 para 14; ele não foi aplicado porque
seria uma mudança incompatível e não corrige comportamento usado diretamente
pelo produto. A equipe deve acompanhar a atualização upstream e repetir a
auditoria em cada PR.
