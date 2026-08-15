# 0009 — Analytics e detalhe do link

**Status:** concluída  
**Dependências:** 0008  
**Rastreabilidade:** RF-10, RF-11, RN-14, RN-15, CA-09

## Contexto e objetivo

Criador e administrador precisam entender o uso do link sem rastrear pessoas.
Esta tarefa entrega o detalhe consolidado com total, evolução diária UTC e
histórico de alterações.

## Requisitos

- Criador consulta seus links; administrador consulta qualquer link da equipe.
- Exibir total e série diária UTC, incluindo zero cliques.
- Alterações de destino não reiniciam nem segmentam analytics.
- Exibir histórico paginado sem carregar toda a retenção ilimitada.
- Cobrir carregando, vazio, sucesso, erro e sem permissão.
- Dados e ações são compreensíveis por teclado e leitor de tela.

## Não escopo

- Visitante único, IP, origem, localização, dispositivo, exportação ou período
  customizado avançado.
- Biblioteca externa de gráficos.

## Suposições

- A primeira visualização pode usar resumo, tabela e barras simples com CSS/tokens;
  a tabela continua sendo a representação acessível dos mesmos dados.
- A janela inicial mostra os 30 dias mais recentes e permite paginação simples
  do histórico; isso não altera a retenção.

## Proposta de solução

Criar a feature `analytics` para consulta e apresentação dos agregados e compor
seu conteúdo no detalhe público da feature `links`, consumindo apenas `index.ts`.
Usar componentes do styleguide e CSS Modules sem dependência de charting.

## Módulos e arquivos previstos

- `src/features/analytics/{model,services,components,tests,index.ts}`.
- detalhe e rota da feature `links`.
- consultas/índices para agregados e histórico.
- testes de permissão, estados, teclado e responsividade.

## Tarefas sequenciais

- [x] Definir contrato de leitura de total, série diária e paginação.
- [x] Implementar consulta autorizada e ordenada dos 30 dias mais recentes.
- [x] Criar resumo do total e visualização diária com tabela acessível.
- [x] Integrar histórico paginado produzido na tarefa 0007.
- [x] Tratar zero, falha parcial, sessão expirada e acesso negado.
- [x] Garantir que membro nunca carregue analytics de link alheio.
- [x] Cobrir layout em celular sem rolagem horizontal essencial.
- [x] Adicionar testes observáveis e E2E do incremento de clique.
- [x] Atualizar documentação e critérios do piloto.

## Riscos

- Série diária e total divergirem por escrita parcial.
- Datas UTC serem apresentadas como horário local sem rótulo.
- Visualização depender apenas de cor.
- Consulta sem limite encarecer ou atrasar a tela.

## Critérios de aceite

- [x] Criador e administrador veem total, últimos 30 dias UTC e histórico.
- [x] Zero cliques aparece como zero/estado vazio, não como erro.
- [x] Membro é recusado ao consultar link de outro criador.
- [x] Edição de destino preserva todos os números anteriores.
- [x] Tabela e ações são acessíveis e responsivas.
- [x] Testes de consulta/componente/E2E e `npm run validate` passam.

## Validação e documentação

- Testes de modelo de datas, queries, Rules, componente e teclado.
- E2E: criar link, redirecionar repetidamente e confirmar total/dia.
- Atualizar documentação de UTC, janela inicial e ausência de dados pessoais.
