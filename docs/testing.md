# Testes

## Filosofia

Testamos o **comportamento observável** da aplicação: o que o usuário vê e faz. Não testamos detalhes internos de implementação. Um bom teste continua passando mesmo que você reorganize o código por dentro, desde que o comportamento continue o mesmo.

## Tipos de teste

- **Unidade**: funções e lógica isoladas (ex.: cálculo, formatação).
- **Componente**: renderização e interação de componentes, com Vitest + React Testing Library.
- **Contrato local**: setup transacional, regras arquiteturais, links da documentação e artefato de build.
- **Backend**: unidades das Functions e autorização das Firestore Security
  Rules no Emulator Suite.
- **E2E**: fluxo crítico no Chromium contra o bundle de produção, com
  Playwright.
- **Identidade visual**: contrato de estilo (valores computados dos tokens) e
  regressão visual da página `/styleguide`.

## Localização

Os testes ficam dentro da feature, na pasta `tests/`:

```
features/minha-feature/
├── components/
├── model/
├── services/
└── tests/        # os testes desta feature
```

## Comandos

```bash
npm run test          # roda os testes uma vez, com limites de cobertura
npm run test:unit     # roda apenas Vitest, sem cobertura (mais rápido)
npm run test:coverage # roda Vitest aplicando os limites de cobertura
npm run test:setup    # testa setup e regras arquiteturais em projetos temporários
npm run test:functions # roda as unidades do backend
npm run test:auth-emulator # valida sessão e logout no Auth Emulator
npm run test:rules    # testa acessos permitidos e negados no Firestore Emulator
npm run test:members-emulator # testa concorrência e propriedade dos links
npm run test:invites-emulator # testa reutilização, expiração e cancelamento
npm run test:links-emulator # testa links, histórico e contadores concorrentes
npm run test:firebase # combina Rules e smoke de Auth/Firestore/Functions/Hosting
npm run test:e2e      # testa o fluxo crítico em um navegador Chromium real
npm run test:e2e:update # regera as imagens de referência do styleguide
npm run test:watch    # roda em modo contínuo enquanto você edita
```

Antes da primeira execução local do E2E, instale o navegador compatível com a
versão do Playwright:

```bash
npx playwright install chromium
```

O E2E escolhe uma porta efêmera, gera o bundle e serve a aplicação localmente.

Os testes Firebase usam exclusivamente `demo-shortener`. `test:rules` exige
Java e valida a baseline deny-by-default. `test:members-emulator` dispara duas
reduções administrativas concorrentes, comprova que resta um administrador e
que remover o criador não apaga seus links. `test:invites-emulator` controla o
relógio, reutiliza o mesmo convite com dois UIDs, repete um consumo e bloqueia
convites vencidos ou cancelados. `test:links-emulator` disputa o mesmo slug em
duas criações, confirma um único vencedor e verifica que link e histórico
nascem juntos. A mesma suíte percorre o ciclo de vida, prova a matriz de
autorização, verifica dois dias UTC e envia uma rajada de oito cliques sem perda
nem documento individual. `test:firebase:smoke` inicia a pilha completa, chama
`/api/health`, valida `302`, headers, conteúdo indisponível, falha de contagem,
rotas SPA e assets através do Hosting Emulator e mede o redirecionamento
aquecido contra o limite de um segundo. Eles ficam fora do
`validate` porque inicializam processos de emulador; o backend aplicável ao
`validate` ainda cobre typecheck, unidade e build.

O E2E principal inicia Auth, Firestore e Functions Emulator, limpa somente o
projeto `demo-shortener` entre projetos e percorre o widget
Google falso por popup sem navegar a SPA, confirma o perfil mínimo, cria duas equipes com suas
associações administrativas e abre uma segunda sessão Google. O administrador
promove, rebaixa e remove o membro, enquanto a segunda sessão comprova a matriz
de ações e a revogação imediata. A suíte também alterna contexto, recusa equipe
manipulada na URL, recarrega a sessão e testa logout, sem credencial real. No
ciclo do link, também edita destino, desativa, arquiva, encontra pelo filtro,
restaura e consulta o histórico. Depois chama a Function pública três vezes,
confirma os três `302` para o destino editado e verifica total e dia UTC no
detalhe. Os testes de Rules comprovam separadamente que criador e administrador
leem agregados, enquanto outro membro não lê nem escreve.

A mesma jornada roda em Chromium desktop e em viewport/dispositivo Pixel 7. O
CI acrescenta um job `Firebase Emulators`, com Java 21, para executar Auth,
Firestore, Functions e Hosting sem recurso real. `test:firebase` mantém uma
única sessão da pilha enquanto roda todas as integrações sequencialmente, o que
evita corrida de portas no desligamento do Java. `check:firebase-safety` falha
se um teste contém o projeto de produção ou inicia emulador sem `demo-shortener`.

## Identidade visual

`e2e/styleguide.spec.ts` protege o styleguide em duas camadas:

1. **Contrato de estilo**: compara os valores realmente aplicados (`--accent`,
   `--danger`, cor de fundo do botão primário, cor da mensagem de erro). É
   determinístico em qualquer sistema operacional e a falha diz exatamente qual
   valor mudou. Roda sempre, inclusive no CI.
2. **Regressão visual**: compara a página `/styleguide` inteira, pixel a pixel,
   com a imagem em `e2e/__screenshots__/<plataforma>/`. Pega mudanças de
   layout e espaçamento que o contrato não vê.

A fonte do sistema muda o resultado, então cada plataforma tem sua própria
imagem. Quando não existe imagem para a plataforma atual (por exemplo, no Linux
do CI antes de alguém gerar a primeira), o teste é **pulado** com a instrução,
em vez de falhar.

Depois de uma mudança visual **intencional**, regere e revise a imagem no diff
do pull request:

```bash
npm run test:e2e:update
```

Se a imagem mudou sem que ninguém tenha mexido no visual, é regressão: veja o
comparativo em `test-results/` antes de aceitar.
Ele não depende de rede externa nem de dados preexistentes. O CI instala também
as dependências de sistema do Chromium e publica trace e screenshot apenas em
caso de falha.

## Cobertura

`npm run test` aplica limites mínimos definidos em `vitest.config.ts`: 85% de instruções e linhas, 75% de ramos e 90% de funções. Uma queda abaixo disso falha o `validate` e o CI.

Os limites existem para impedir regressão, não para virar meta. Não escreva teste de caso impossível só para subir o número — se um trecho é difícil de cobrir, normalmente ele está pedindo para ser simplificado. O relatório HTML fica em `coverage/` após rodar `npm run test:coverage`.

## Exemplo curto

```tsx
import { render, screen } from '../../../test/render';
import { Saudacao } from '../components/Saudacao';

test('mostra o nome informado', () => {
  render(<Saudacao nome="Ana" />);
  expect(screen.getByText('Olá, Ana')).toBeInTheDocument();
});
```

### Injeção de Dependências em Testes

Para componentes que dependem de estado global, providers de roteamento, ou clientes de API, o ambiente de testes deve fornecer instâncias ou mocks desses contextos (Dependency Injection via Context).

- Em vez de importar o `render` do `@testing-library/react` em cada arquivo, centralizamos essa configuração em um utilitário próprio, como um `renderWithProviders`.
- No nosso template, a importação customizada de `../../../test/render` (mostrada acima) se encarrega de envelopar o componente com todos os Providers necessários, garantindo que a árvore de componentes em teste tenha o mesmo contexto que a aplicação real.

O foco é no que aparece na tela, não em como o componente foi escrito por dentro.

### O que já vem testado

A composição da aplicação tem smoke test em `src/app/tests/`: a rota raiz monta com layout e página inicial, um endereço desconhecido cai na tela de "não encontrada" sem derrubar o layout, e uma rota que lança erro é substituída pelo `errorElement`. Se você mexer em rotas ou no layout, esses testes são a primeira rede.

O setup também é comportamento público do template. Seus testes executam dry-run, personalização, repetição idempotente e rollback em pastas temporárias. A persistência testa migração, backup de dados inválidos, conflitos de revisão e sincronização entre abas. O smoke test serve `dist/` em uma porta efêmera e acessa o HTML e seus assets como um navegador faria.

O smoke E2E complementa essas redes executando o fluxo Google e de equipes no
Chromium contra os emuladores. Ele fica em um gate separado de
`npm run validate` para que a validação local não baixe binários de navegador
implicitamente.

## O que NÃO testar

- Estado interno ou nomes de variáveis do componente.
- Detalhes de implementação de bibliotecas de terceiros.
- Estilos puramente visuais sem impacto no comportamento.
- Casos impossíveis só para "aumentar cobertura".

## Investigar falhas

1. Leia a mensagem de erro: ela costuma indicar o que era esperado e o que aconteceu.
2. Rode em modo contínuo (`npm run test:watch`) e ajuste até passar.
3. Se um teste falha após uma mudança de comportamento intencional, atualize o teste para o novo comportamento esperado.
4. Se a falha for inesperada, corrija o código, não o teste.
