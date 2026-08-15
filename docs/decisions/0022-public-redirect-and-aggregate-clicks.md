# ADR 0022: redirecionamento público com contagem agregada

## Status

Aceita.

## Contexto

O endereço curto precisa responder sem sessão, considerar imediatamente o
estado e o destino atuais e contar cada resposta bem-sucedida sem criar um
registro identificável por acesso. Uma falha de persistência não pode confirmar
um clique nem enviar o visitante ao destino.

## Decisão

- Resolver `links/{slug}` e atualizar `totalClicks` e
  `dailyClicks/{YYYY-MM-DD}` na mesma transação do Firestore, usando o dia UTC.
- Responder `302` somente após a transação concluir. Não usar redirect permanente
  nem cache duradouro, pois destino e estado podem mudar.
- Aceitar somente `GET` como clique. Métodos diferentes respondem `405` e não
  alteram contadores.
- Retornar o mesmo HTML genérico com `404` para link inexistente, inválido,
  desativado ou arquivado. Falha ao ler ou contar usa o mesmo conteúdo com
  `503`, sem cabeçalho `Location`.
- Persistir somente total e um documento por dia. Não criar evento individual
  nem campos de IP, usuário, referrer, dispositivo ou localização.
- Preservar primeiro as rotas `/`, `/login`, `/styleguide`, `/app/**` e
  `/invite/**`; somente um segmento público restante chega à Function.
- Aplicar `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, CSP e
  `X-Content-Type-Options: nosniff` às respostas públicas.
- Não emitir logs de aplicação por requisição. A operação acompanha taxa de
  `5xx` e latência pelas métricas agregadas da plataforma.

## Consequências

- A contagem confirmada e o redirecionamento não divergem em falhas conhecidas.
- Cliques repetidos são contabilizados, mas não podem ser separados em
  visitantes ou segmentos.
- Transações concorrentes evitam incrementos perdidos, embora um único documento
  de link seja ponto de contenção. Contadores distribuídos ficam para uma
  evolução motivada por carga real.
- Assets existentes têm prioridade no Hosting; slugs reservados impedem conflito
  com caminhos operacionais mesmo quando um arquivo deixa de existir.
- O teste local aquecido mais recente mediu 72,2 ms; a medição no ambiente publicado continua
  sendo gate da entrega piloto. Veja
  [a evidência de desempenho](../redirect-performance.md).
