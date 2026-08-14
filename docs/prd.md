# PRD — Short Links

**Status:** Aprovado  
**Última atualização:** 2026-08-14

## 1. Visão do produto

### Problema

Equipes internas publicam muitos links públicos e hoje precisam compartilhar
endereços longos, difíceis de lembrar e sujeitos a erros. Também não têm uma
visão simples de quantas vezes cada link foi acessado nem uma forma centralizada
de controlar quem pode criar e administrar esses endereços.

### Proposta de valor

O Short Links permite que uma equipe autenticada crie endereços públicos
curtos, personalizados e memoráveis, preserve o controle desses links ao longo
do tempo e acompanhe cliques sem identificar os visitantes.

### Objetivo da primeira versão

Permitir que uma equipe piloto crie, compartilhe e administre ao menos 20 links
curtos no primeiro mês, com redirecionamentos e analytics funcionando sem falha
crítica.

## 2. Usuários

### Usuário principal

Membro de uma equipe interna que publica links públicos com frequência e precisa
criar, alterar e acompanhar seus próprios endereços curtos.

### Usuários secundários

- Administrador da equipe, responsável por membros, convites e por todos os
  links e analytics da equipe.
- Visitante público, que acessa um endereço curto sem entrar no sistema e é
  redirecionado ao destino configurado.

### Usuários não atendidos nesta versão

- Pessoas sem conta Google que precisem administrar links.
- Visitantes que queiram criar links anonimamente.
- Clientes externos que precisem de contas, domínios ou relatórios próprios.

## 3. Jornada principal

1. A pessoa entra com sua conta Google.
2. Ela cria uma equipe ou participa de uma equipe por um convite ainda válido.
3. Ela escolhe a equipe em que deseja trabalhar.
4. Ela informa um destino HTTP ou HTTPS e um identificador curto personalizado.
5. O produto valida os dados e cria um endereço curto globalmente único.
6. Um visitante acessa publicamente esse endereço e é redirecionado ao destino.
7. O redirecionamento bem-sucedido incrementa o total e o agregado diário do
   link sem registrar dados pessoais do visitante.
8. O criador consulta analytics e histórico do próprio link; um administrador
   pode fazer o mesmo para qualquer link da equipe.

## 4. Escopo da primeira versão

| Capacidade               | Benefício para o usuário                                       | Limites                                                                   |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Autenticação com Google  | Restringe a administração dos links a pessoas identificadas    | Não oferece senha, outro provedor ou criação anônima                      |
| Equipes e permissões     | Separa os espaços de trabalho e mantém controle administrativo | Apenas os níveis administrador e membro                                   |
| Convites por link        | Permite entrada simples de vários membros                      | Requer login Google; o convite expira ou pode ser cancelado               |
| Gestão de links          | Cria endereços memoráveis e permite corrigir o destino         | Sem expiração automática; identificadores arquivados não são reutilizados |
| Redirecionamento público | Entrega o destino a qualquer visitante                         | Links inválidos, desativados ou arquivados mostram uma página genérica    |
| Analytics simples        | Mostra uso total e evolução diária                             | Sem visitante único, IP, origem, localização ou dispositivo               |
| Histórico de alterações  | Mantém rastreabilidade operacional                             | Retido sem limite durante a vida da equipe                                |

## 5. Requisitos funcionais

### RF-01 — Entrar e sair com Google

- **Quem:** usuário administrativo do produto.
- **Interface/gatilho:** botão de entrada ou ação de saída.
- **Entrada:** conta Google escolhida pelo usuário.
- **Comportamento:** autenticar com Firebase Authentication e criar ou recuperar
  o perfil mínimo necessário para acesso e auditoria.
- **Saída:** sessão autenticada ou retorno à tela de entrada após sair.
- **Exceções:** cancelamento ou falha do provedor mantém a pessoa desconectada e
  apresenta uma mensagem que permite tentar novamente.

### RF-02 — Criar, escolher e participar de equipes

- **Quem:** usuário autenticado.
- **Interface/gatilho:** criação de equipe, seletor de equipe ou acesso a um
  convite válido.
- **Entrada:** nome da equipe ou token do convite.
- **Comportamento:** permitir criar e participar de várias equipes e alternar o
  contexto ativo.
- **Saída:** dashboard da equipe selecionada.
- **Exceções:** convite inválido, vencido ou cancelado não concede acesso.

### RF-03 — Administrar membros e permissões

- **Quem:** administrador da equipe.
- **Interface/gatilho:** configurações da equipe.
- **Entrada:** membro e ação de remover, promover ou rebaixar.
- **Comportamento:** aplicar imediatamente a nova associação ou permissão.
- **Saída:** lista de membros atualizada e confirmação da ação.
- **Exceções:** impedir que o último administrador saia, seja removido ou
  rebaixado antes de promover outro membro.

### RF-04 — Criar e controlar convites

- **Quem:** administrador da equipe.
- **Interface/gatilho:** área de convites nas configurações.
- **Entrada:** data e hora futuras de validade escolhidas pelo administrador.
- **Comportamento:** gerar um link não vinculado a e-mail, reutilizável por
  qualquer usuário autenticado até vencer ou ser cancelado.
- **Saída:** link copiável, validade e estado atual do convite.
- **Exceções:** datas passadas são recusadas; convite cancelado ou vencido não
  pode adicionar membros.

### RF-05 — Criar link curto

- **Quem:** administrador ou membro da equipe ativa.
- **Interface/gatilho:** formulário de novo link.
- **Entrada:** destino iniciado por `http://` ou `https://` e identificador de 3
  a 50 caracteres com letras minúsculas, números ou hífen.
- **Comportamento:** validar a entrada e reservar o identificador sem diferenciar
  maiúsculas de minúsculas, garantindo unicidade global.
- **Saída:** endereço público curto pronto para copiar.
- **Exceções:** destino inválido, identificador reservado, formato inválido ou
  identificador já utilizado apresenta erro específico sem criar o link.

### RF-06 — Listar e consultar links

- **Quem:** administrador ou membro da equipe ativa.
- **Interface/gatilho:** dashboard ou abertura do detalhe de um link.
- **Entrada:** equipe ativa e filtros disponíveis na própria tela.
- **Comportamento:** administrador consulta todos os links da equipe; membro
  consulta apenas os links que criou.
- **Saída:** lista e detalhe compatíveis com a permissão atual.
- **Exceções:** ausência de links mostra orientação para criar o primeiro; falha
  de leitura apresenta uma ação para tentar novamente.

### RF-07 — Alterar link e registrar histórico

- **Quem:** criador do link ou administrador da equipe.
- **Interface/gatilho:** edição do detalhe do link.
- **Entrada:** novo destino HTTP ou HTTPS.
- **Comportamento:** alterar o destino sem limitar o número de mudanças e
  registrar autor, data, valor anterior e valor novo.
- **Saída:** link atualizado e novo item no histórico.
- **Exceções:** destino inválido não altera o link nem o histórico.

### RF-08 — Desativar, arquivar e restaurar link

- **Quem:** criador do link ou administrador da equipe.
- **Interface/gatilho:** ações do detalhe ou da lista.
- **Entrada:** link e ação escolhida.
- **Comportamento:** interromper ou restaurar o redirecionamento, preservando
  endereço, histórico e analytics.
- **Saída:** novo estado visível e alteração registrada no histórico.
- **Exceções:** um link arquivado mantém seu identificador reservado e não pode
  ser recriado como outro link.

### RF-09 — Redirecionar acesso público

- **Quem:** visitante público.
- **Interface/gatilho:** acesso ao endereço curto.
- **Entrada:** identificador presente na URL.
- **Comportamento:** localizar um link ativo, registrar o clique agregado e
  iniciar o redirecionamento para o destino atual.
- **Saída:** destino carregado em até 1 segundo em condições normais.
- **Exceções:** identificador inexistente, desativado ou arquivado mostra “Link
  indisponível” sem revelar equipe, criador ou destino.

### RF-10 — Consultar analytics

- **Quem:** criador do link ou administrador da equipe.
- **Interface/gatilho:** detalhe do link.
- **Entrada:** link autorizado.
- **Comportamento:** apresentar total de redirecionamentos bem-sucedidos e
  evolução diária agregada em UTC, incluindo acessos repetidos.
- **Saída:** total e série diária atualizados.
- **Exceções:** ausência de cliques apresenta zero e um estado vazio; falha de
  leitura não expõe dados parciais como se estivessem completos.

### RF-11 — Consultar histórico

- **Quem:** criador do link ou administrador da equipe.
- **Interface/gatilho:** área de histórico no detalhe do link.
- **Entrada:** link autorizado.
- **Comportamento:** apresentar em ordem cronológica as criações, alterações de
  destino e mudanças de estado com autor e data.
- **Saída:** histórico completo durante a vida da equipe.
- **Exceções:** usuários sem permissão não recebem o conteúdo do histórico.

## 6. Regras de negócio

- **RN-01:** somente usuários autenticados pelo Google podem criar ou administrar
  equipes, convites e links; o redirecionamento permanece público.
- **RN-02:** quem cria uma equipe se torna seu primeiro administrador.
- **RN-03:** um usuário pode criar e participar de várias equipes.
- **RN-04:** administrador gerencia membros, convites e todos os links e dados da
  equipe; membro gerencia e consulta somente os próprios links.
- **RN-05:** um convite não é vinculado a e-mail, pode ser usado por várias
  pessoas e deixa de funcionar ao vencer ou ser cancelado.
- **RN-06:** o último administrador não pode sair, ser removido nem rebaixado.
- **RN-07:** links pertencem à equipe e permanecem sob controle dos
  administradores quando o criador sai.
- **RN-08:** identificadores têm de 3 a 50 caracteres, aceitam apenas letras
  minúsculas, números e hífen, são comparados sem diferença de caixa e são
  únicos em todo o sistema.
- **RN-09:** rotas reservadas pelo produto não podem ser usadas como
  identificadores curtos.
- **RN-10:** somente destinos HTTP e HTTPS são aceitos.
- **RN-11:** links não expiram automaticamente.
- **RN-12:** alterações não têm limite e sempre geram histórico com autor, data,
  valor anterior e valor novo.
- **RN-13:** arquivar é uma exclusão reversível; endereço, histórico e analytics
  são preservados e o identificador nunca volta ao conjunto disponível.
- **RN-14:** cada redirecionamento bem-sucedido incrementa o total e o dia em
  UTC, inclusive quando o mesmo visitante acessa repetidamente.
- **RN-15:** uma alteração de destino não reinicia nem separa os analytics do
  link.
- **RN-16:** permissões são verificadas no backend e nas regras do banco; ocultar
  uma ação somente na interface não é controle de acesso suficiente.

## 7. Dados e arquivos

| Dado/arquivo      | Formato                                                | Origem                             | Obrigatório | Armazenamento e prazo                                           | Alteração/exclusão                                                     | Sensível                                       |
| ----------------- | ------------------------------------------------------ | ---------------------------------- | ----------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| Perfil do usuário | UID, nome e e-mail                                     | Google via Firebase Authentication | Sim         | Firestore enquanto necessário para associação e auditoria       | Atualizado no login; referência histórica preservada                   | Sim; acesso restrito aos membros autorizados   |
| Equipe            | Identificador e nome                                   | Administrador                      | Sim         | Firestore, sem exclusão completa na primeira versão             | Nome pode ser alterado por administrador                               | Não                                            |
| Associação        | Equipe, usuário e nível                                | Administrador ou convite           | Sim         | Firestore durante a associação; histórico preservado            | Remoção encerra acesso imediatamente                                   | Sim; relaciona pessoa e equipe                 |
| Convite           | Token, equipe, validade, estado e criador              | Administrador                      | Sim         | Firestore até vencer ou ser cancelado, com registro operacional | Pode ser cancelado; não é vinculado a e-mail                           | Sim; o token concede entrada enquanto válido   |
| Link              | Identificador curto, destino, estado, equipe e criador | Criador do link                    | Sim         | Firestore durante a vida da equipe, inclusive arquivado         | Destino e estado podem mudar; identificador não muda nem é reutilizado | Não, pois destino e endereço são públicos      |
| Histórico do link | Ação, autor, data, valor anterior e valor novo         | Operações autorizadas              | Sim         | Firestore sem limite durante a vida da equipe                   | Somente leitura; não é apagado na primeira versão                      | Sim; identifica o autor da ação                |
| Analytics diário  | Link, dia UTC e quantidade                             | Redirecionamentos públicos         | Sim         | Firestore como agregados durante a vida da equipe               | Incrementado a cada redirecionamento; preservado ao arquivar           | Não; não contém evento ou visitante individual |

Não há importação nem exportação de arquivos na primeira versão.

## 8. Integrações e dependências

| Integração/dependência             | Finalidade                                                  | Comportamento em falha                                                           |
| ---------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Google via Firebase Authentication | Entrada e identificação dos usuários                        | Mantém a pessoa desconectada e permite tentar novamente                          |
| Cloud Firestore                    | Equipes, permissões, links, convites, histórico e analytics | Mostra estado de erro sem confirmar uma operação não persistida                  |
| Cloud Functions for Firebase       | Redirecionamentos e operações protegidas                    | Não redireciona nem conta clique se o destino não puder ser obtido com segurança |
| Firebase Hosting                   | Interface web e domínio público curto                       | Exibe a indisponibilidade fornecida pela plataforma; não há modo offline         |

## 9. Interface e estados

| Tela ou componente             | Carregando                             | Vazio                                      | Sucesso                                         | Erro                                       | Sem permissão                                       | Navegação por teclado                                         |
| ------------------------------ | -------------------------------------- | ------------------------------------------ | ----------------------------------------------- | ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------- |
| Entrada                        | Indica autenticação em andamento       | Não se aplica                              | Abre a equipe disponível ou o início sem equipe | Explica a falha e oferece nova tentativa   | Não se aplica                                       | Botão de entrada recebe foco e funciona por teclado           |
| Seletor e dashboard            | Exibe estado de carregamento           | Orienta criar equipe ou entrar por convite | Lista equipes e links permitidos                | Preserva contexto e oferece nova tentativa | Não mostra dados de equipes não autorizadas         | Seletor, filtros, linhas e ações seguem ordem previsível      |
| Formulário de link             | Indica salvamento e bloqueia repetição | Não se aplica                              | Confirma criação ou alteração e oferece cópia   | Associa a mensagem ao campo ou à operação  | Ação indisponível e tentativa recusada pelo backend | Campos, mensagens e ações são operáveis sem mouse             |
| Detalhe, analytics e histórico | Exibe estado de carregamento           | Mostra zero cliques ou histórico inicial   | Exibe total, série diária e alterações          | Oferece nova tentativa sem inventar dados  | Mostra estado de acesso negado sem conteúdo privado | Abas, ações e dados têm foco e rótulos acessíveis             |
| Membros e convites             | Exibe estado de carregamento           | Orienta criar o primeiro convite           | Confirma alterações e permite copiar convite    | Explica data inválida, conflito ou falha   | Membro comum não recebe controles administrativos   | Lista, data, cópia e ações funcionam por teclado              |
| Redirecionamento público       | Mostra espera apenas quando necessária | Não se aplica                              | Abre o destino                                  | Mostra “Link indisponível”                 | Não se aplica                                       | A página de indisponibilidade tem estrutura e foco acessíveis |

## 10. Plataformas e distribuição

- **Dispositivos e navegadores:** interface responsiva para computador e
  celular nas versões atuais de Chrome, Edge, Firefox e Safari.
- **Forma de entrega:** SPA hospedada no Firebase Hosting, com um único domínio
  curto configurado para todo o produto e backend no Firebase.
- **Instalação e atualização:** acesso pelo navegador; novas versões são
  publicadas no Firebase Hosting, sem instalação pelo usuário.
- **Uso sem conexão:** não se aplica, pois autenticação, permissões,
  redirecionamentos e dados dependem do Firebase.

## 11. Restrições e requisitos de qualidade

- **Acessibilidade da interface:** todas as ações essenciais funcionam por
  teclado, o foco é visível, campos têm rótulos e erros são associados à ação ou
  entrada correspondente.
- **Idiomas:** português do Brasil.
- **Desempenho:** o redirecionamento deve começar em até 1 segundo em condições
  normais; não há outra meta específica de desempenho para o dashboard na
  primeira versão.
- **Privacidade e acesso:** dados administrativos exigem autenticação e
  autorização; cliques não armazenam IP, pessoa, localização, dispositivo,
  origem nem evento individual.
- **Portabilidade:** navegadores atuais em computador e celular; não há
  compromisso com aplicativo nativo.
- **Responsividade visual:** fluxos essenciais não exigem rolagem horizontal nem
  perdem ações em telas menores.
- **Outras restrições:** o backend deve permanecer dentro dos serviços Firebase
  aprovados para a primeira versão.

## 12. Critérios de sucesso

| Indicador                           | Meta                                                   | Como medir                                                              | Quando avaliar                  |
| ----------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------- |
| Links utilizados pela equipe piloto | Pelo menos 20 links criados                            | Contagem de links não descartados no Firestore                          | Ao final do primeiro mês de uso |
| Confiabilidade do fluxo crítico     | Nenhuma falha crítica de redirecionamento ou analytics | Registro de incidentes que impeçam redirecionar ou contabilizar cliques | Durante o primeiro mês de uso   |

## 13. Critérios de aceite

- **CA-01:** dado um visitante desconectado, quando ele abre o dashboard, então o
  produto solicita entrada com Google e não mostra dados administrativos.
- **CA-02:** dado um usuário autenticado, quando ele cria uma equipe, então se
  torna administrador e pode selecioná-la no dashboard.
- **CA-03:** dado um convite reutilizável dentro da validade, quando diferentes
  usuários autenticados o acessam, então cada um entra na equipe como membro.
- **CA-04:** dado um convite vencido ou cancelado, quando um usuário o acessa,
  então o acesso é recusado sem adicioná-lo à equipe.
- **CA-05:** dado um membro autorizado, quando informa destino válido e
  identificador disponível, então recebe um endereço público copiável.
- **CA-06:** dado um identificador já usado, arquivado, reservado ou com formato
  inválido, quando alguém tenta criá-lo, então o produto recusa a operação e
  explica o motivo.
- **CA-07:** dado um link ativo, quando um visitante abre seu endereço curto,
  então é redirecionado ao destino atual e o clique incrementa o total e o dia
  UTC.
- **CA-08:** dado um link inexistente, desativado ou arquivado, quando alguém
  abre seu endereço, então vê “Link indisponível” sem dados internos.
- **CA-09:** dado o criador de um link, quando abre o detalhe, então vê o total,
  a evolução diária e todo o histórico desse link.
- **CA-10:** dado um membro comum, quando tenta consultar ou alterar o link de
  outro membro, então a interface e o backend recusam o acesso.
- **CA-11:** dado um administrador, quando consulta a equipe, então pode ver e
  administrar todos os links, analytics, membros e convites dela.
- **CA-12:** dado um link alterado, quando criador ou administrador salva um novo
  destino válido, então o endereço curto permanece igual, analytics são
  preservados e o histórico registra autor, data e valores.
- **CA-13:** dado um link arquivado, quando alguém tenta reutilizar seu
  identificador, então a criação é recusada; quando ele é restaurado, o mesmo
  endereço e os dados anteriores voltam a ficar disponíveis.
- **CA-14:** dado que existe somente um administrador, quando ele tenta sair ou
  perder o nível, então a operação é bloqueada até que outro membro seja
  promovido.
- **CA-15:** dados os fluxos essenciais em computador ou celular, quando usados
  apenas com teclado, então entrada, criação de link, consulta e administração
  permanecem operáveis com foco visível.

## 14. Não escopo

- Login por senha, e-mail ou provedores diferentes do Google.
- Criação anônima de links.
- Domínios personalizados por equipe.
- Expiração automática de links.
- Visitantes únicos, IP, identidade, localização, dispositivo ou origem do
  clique.
- Eventos individuais de acesso.
- Exclusão definitiva de equipes.
- Reutilização de identificadores arquivados.
- Aplicativo nativo, instalável ou com funcionamento offline.
- Importação ou exportação de arquivos.

## 15. Decisões e motivos

| Decisão       | Escolha                                                       | Motivo                                                                                 | Alternativa descartada                                                    |
| ------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Identidade    | Login somente com Google                                      | Reduz gerenciamento de credenciais para uma equipe interna                             | Senha ou vários provedores aumentariam o escopo                           |
| Backend       | Firebase Authentication, Firestore, Cloud Functions e Hosting | Atende autenticação, autorização, persistência e redirecionamento no mesmo ecossistema | Aplicação somente local não atende compartilhamento nem acesso público    |
| Permissões    | Administrador e membro                                        | Cobre controle da equipe sem multiplicar níveis                                        | Mais níveis aumentariam regras e testes na primeira versão                |
| Convite       | Reutilizável, sem e-mail e com validade escolhida             | Facilita entrada de vários colegas por um mesmo endereço                               | Convite individual por e-mail cria mais etapas                            |
| Identificador | Personalizado e globalmente único                             | Produz endereços memoráveis e previsíveis                                              | Identificador apenas automático não atende a proposta principal           |
| Exclusão      | Arquivamento reversível e identificador reservado             | Preserva auditoria e impede que links antigos apontem para conteúdo novo               | Exclusão definitiva permitiria perda de histórico e reutilização perigosa |
| Analytics     | Total e agregado diário em UTC                                | Entrega a medida necessária com baixo custo e sem rastrear pessoas                     | Eventos detalhados ampliariam privacidade, armazenamento e complexidade   |
| Domínio       | Um domínio curto para o produto                               | Mantém configuração e operação simples                                                 | Domínio por equipe fica fora da primeira versão                           |
| Destinos      | HTTP e HTTPS                                                  | Mantém compatibilidade com endereços públicos legados                                  | Exigir HTTPS excluiria destinos ainda usados pela equipe                  |

## 16. Decisões em aberto

Nenhuma.
