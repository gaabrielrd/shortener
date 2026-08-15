# ADR 0023: analytics agregados autorizados no detalhe

## Status

Aceita.

## Contexto

Criadores e administradores precisam avaliar o uso de um link sem identificar
visitantes. O detalhe já mostra gestão e histórico; a evolução diária deve ser
limitada, acessível e capaz de falhar sem impedir as outras operações.

## Decisão

- Criar a feature `analytics`, sem dependência de biblioteca de gráficos, e
  compor sua interface pública no detalhe da feature `links`.
- Usar `totalClicks` do documento do link e consultar somente
  `dailyClicks/{YYYY-MM-DD}` entre o início e o fim da janela móvel de 30 dias
  UTC, em ordem e com limite 30.
- Preencher no cliente cada data ausente com zero. Datas são formatadas com
  `timeZone: UTC` e rotuladas explicitamente para não sofrer deslocamento local.
- Permitir leitura da subcoleção somente ao criador do link ou administrador da
  equipe; clientes nunca escrevem agregados.
- Apresentar resumo, barras simples e tabela com os mesmos valores. A tabela é a
  representação acessível e não depende de cor, hover ou precisão visual.
- Manter total, edição e histórico disponíveis quando apenas a consulta diária
  falhar, com mensagem específica e tentativa novamente pelo teclado.
- Manter histórico paginado em páginas de dez, sem alterar sua retenção.

## Consequências

- A tela faz no máximo uma leitura de 30 documentos por carregamento normal.
- Zero cliques é um estado válido: total zero, aviso vazio e dias representados
  como zero.
- Analytics anteriores atravessam alterações de destino e estado porque não são
  segmentados por versão.
- A série não oferece período customizado, visitantes únicos, exportação ou
  qualquer dimensão pessoal.
