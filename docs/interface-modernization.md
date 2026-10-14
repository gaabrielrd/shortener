# Modernização da interface

## Objetivo e direção

Modernizar o Short Links como um produto administrativo: contexto compacto,
ações claras e listas legíveis. Preservar a identidade Vitru, TheMix nos títulos,
Archivo nos textos, os tokens e os componentes de `@vitru/styleguide`.

A composição usa superfícies claras, separadores discretos e uma ação primária
por tela. Animações se limitam ao feedback de interação, com movimento reduzido
respeitado. Não adicionar fontes, dependências, backend ou métricas novas.

## Diagnóstico

- `App` concentra marca e conta em um cabeçalho com largura limitada.
- `TeamWorkspace` empilha título, descrição, seletor e abas; as telas repetem
  o nome da equipe em seus títulos.
- `LinksPage` apresenta o formulário completo antes da listagem, mesmo para
  quem só precisa copiar ou gerenciar um endereço.
- A lista separa endereço e destino em colunas e depende de rolagem lateral
  em telas pequenas.
- O detalhe começa pelo título e depois pelo retorno à lista; a cópia não
  está disponível junto ao endereço.
- Analytics mostra gráfico e tabela de 30 dias simultaneamente, alongando o
  detalhe. A tabela continua necessária como alternativa acessível ao gráfico.
- Membros, convites e login precisam acompanhar a mesma hierarquia.

## Composição de referência

### Computador

1. Cabeçalho compacto: marca à esquerda, conta à direita.
2. Faixa de contexto: nome da equipe e papel à esquerda, seletor à direita.
3. Abas: Links, Membros e Convites, conforme as permissões existentes.
4. Cabeçalho da seção: título curto, descrição de escopo e ação principal.
5. Filtro e quantidade de links visíveis.
6. Lista: endereço e destino agrupados, criador, data, estado e ações.

O formulário abre no `Dialog` do kit. A URL de destino vem primeiro, seguida
do endereço personalizado e sua prévia. Erros permanecem no diálogo; o sucesso
fecha o diálogo e oferece cópia do endereço criado na página.

### Celular (a partir de 360 px)

O cabeçalho conserva marca e acesso à conta. Contexto e seletor se empilham;
abas permanecem acessíveis. A ação principal ocupa a largura disponível.
A lista de links passa a itens verticais com endereço, destino, metadados,
estado, cópia e gerenciamento. URLs longas não aumentam a largura da página.
Tabelas complementares podem rolar dentro de seu próprio contêiner.

### Detalhe

Retorno à lista, título do link, estado e cópia no topo. Destino e analytics
formam a área principal. Histórico vem depois; ações de desativar, arquivar
e restaurar ficam em uma seção separada, preservando confirmações.

## Etapas e validação

| Etapa | Entrega                                        | Verificação                                                                    |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| 1     | Diagnóstico e composição de referência         | Validação da base e inspeção no navegador                                      |
| 2     | `App` e `TeamWorkspace`                        | `npm run validate`, contexto e navegação                                       |
| 3     | Lista, criação e detalhe de links              | `npm run validate`, diálogo, cópia, filtros e ciclo de vida                    |
| 4     | Analytics, membros, convites e primeiro acesso | `npm run validate`, permissões e feedback                                      |
| 5     | Revisão visual e preview                       | E2E desktop/celular, 360 px, teclado, capturas e deploy de teste se disponível |

Cada etapa recebe um commit após a validação. O preview não publica uma nova
versão no canal de produção nem altera o backend.

## Critérios de aceite

- Equipe e seção atual ficam identificáveis sem títulos repetidos.
- A listagem prioriza consulta, cópia e gerenciamento; criação abre em diálogo.
- Diálogo recebe foco no primeiro campo, aceita teclado e devolve foco ao
  gatilho ao fechar; fechamento durante envio não descarta a operação.
- A interface funciona em 360 px sem rolagem horizontal na página.
- Estados de carregamento, vazio, erro e sucesso são preservados.
- Controles têm nomes acessíveis e foco visível; contraste segue o tema AA.
- `/styleguide`, permissões, autenticação e histórico continuam funcionais.
- Validação, cobertura e E2E passam sem relaxar os gates existentes.

## Riscos e limites

O kit compartilhado é a fonte dos componentes e tokens; melhorias que exijam
mudança de seu contrato pertencem ao repositório `styleguide-vitru`. Não alterar
o pacote instalado. A composição deve acomodar nomes e URLs longos.

Um canal de teste Firebase depende de autenticação disponível e de domínio
autorizado para login Google. Na ausência de credenciais, entregar capturas e
instruções locais reproduzíveis, registrando a limitação.
