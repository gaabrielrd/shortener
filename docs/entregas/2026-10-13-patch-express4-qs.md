# Patch compatível de Express 4 e qs

Atualiza apenas o lock: Express 4.22.2 para 4.22.3, body-parser 1.20.6
para 1.20.8 e qs 6.15.3 para 6.16.0. Express 5 e manifests diretos
permanecem iguais. path-to-regexp já estava em 0.1.13.

## Compatibilidade verificada

Registro oficial consultado em 13/10/2026:

- [Express 4.22.3](https://registry.npmjs.org/express/4.22.3) usa
  qs ~6.16.0, body-parser ~1.20.5 e path-to-regexp ~0.1.13.
- [body-parser 1.20.8](https://registry.npmjs.org/body-parser/1.20.8) usa qs ~6.16.0.
- Firebase CLI 15.33.0 permite Express ^4.16.4 e body-parser ^1.19.0.
- exegesis 4.3.0 permite body-parser ^1.18.3.

## Auditoria

Mesmo npm 10.6.0 antes e depois: 7 altos/7 moderados para
7 altos/4 moderados, total 14 para 11. Eliminados os alertas de qs
GHSA-x5fp-wj9c-mxmx e GHSA-4mjr-xmp4-gh2g e a propagação moderada
em body-parser e Express. Contagem npm é por pacote afetado.

Permanecem basic-ftp/get-uri e braces/chokidar, com propagação alta
até Firebase CLI; moderados de OpenTelemetry e uuid com seus consumidores.
Não há merge enquanto a auditoria continuar vermelha.

## Testes e revisão

npm ci passou em Node 22.22.2/npm 10.6.0. Validate, Chromium E2E e
Firebase Emulators completos foram iniciados; resultados finais serão
registrados no PR, distinguindo execução local e CI no SHA publicado.
Diff revisado: lock e evidência, sem novos overrides, alterações de
permissões, redução de testes ou segredos.

Principal confirmada em af3ad3a após merge do PR14. PR15/16 estão
fechados e PR17–19 propõem majors; nenhum foi alterado ou reaberto.

## Retomada de 15/10/2026: Firebase CLI 15.34.0

Atualização autorizada no mesmo PR20 e na mesma branch. A principal havia
avançado para 18b6508, com a modernização de interface do PR21. Esse avanço
foi incorporado por merge à branch antes de testar. Nenhum arquivo de
interface, teste, workflow ou manifesto direto foi alterado neste incremento.

O lock passa de Firebase CLI 15.33.0 para 15.34.0, dentro da faixa ^15.30.2
existente. A [release oficial](https://github.com/firebase/firebase-tools/releases/tag/v15.34.0)
remove proxy-agent, universal-analytics e @apphosting/common; o
[manifesto publicado](https://registry.npmjs.org/firebase-tools/15.34.0)
confirma a remoção e mantém chokidar ^3.6.0. Node 22 é suportado.
Express 4.22.3, body-parser 1.20.8 e qs 6.16.0 do patch anterior permanecem.

O lock e a árvore instalada não contêm proxy-agent, pac-proxy-agent,
get-uri ou basic-ftp. Não há override novo. Chokidar 3.6.0 e braces 3.0.3
permanecem, sem release corrigida de braces disponível no npm nesta consulta.

Auditoria comparada com npm 10.6.0 nesta execução:

| Estado                 | Altos | Moderados | Pacotes afetados |
| ---------------------- | ----- | --------- | ---------------- |
| PR20 antes da retomada | 7     | 4         | 11               |
| CLI 15.34.0            | 3     | 4         | 7                |

Eliminados os quatro pacotes afetados basic-ftp, get-uri, pac-proxy-agent
e proxy-agent. Os altos restantes são braces (GHSA-vfj7-8cjw-p6xm), chokidar
e Firebase CLI por propagação. Moderados restantes: @opentelemetry/core e
uuid, propagados por @google-cloud/pubsub e gaxios. Esta contagem npm não é
diretamente comparável à contagem de advisories do pnpm no PoE.

Validação local, Node 22.22.2/npm 10.6.0:

- `npm ci`: passou.
- `npm run validate`: passou, com 115 testes web com cobertura, 38 de
  Functions e 51 contratos, lint, tipos, arquitetura, documentação, build e smoke.
- `npm run test:firebase`: 26 integrações passaram; smoke Firebase passou,
  incluindo health HTTP 200 e redirecionamento aquecido de 49.8 ms.

O primeiro E2E encontrou o Chromium exigido ausente; o navegador oficial do
Playwright foi baixado em diretório local de ferramentas. Depois, a porta
8080 permaneceu ocupada pelo Java órfão da própria suíte demo. O caminho,
projeto e processo pai foram conferidos antes de encerrar somente esse
processo e repetir a execução. Nenhum teste ou timeout foi alterado.

A execução com navegador disponível e porta livre passou a jornada desktop
e o contrato de estilo; pulou a captura sem baseline Windows e falhou na
jornada mobile ao aguardar `/beto-eventos` (5 s, campo de slug inválido no
formulário). A interface e esse teste vieram da principal e foram preservados.
Essa falha local não é apresentada como aprovação dos E2E completos.

Revisão semântica confirmou os manifests de workspace e ranges preservados.
Arquivos do incremento: lock e este registro. A auditoria continua falhando;
PR20 permanece parcial e não deve ser integrado enquanto houver check vermelho.
Resultados do E2E e do CI no SHA publicado ficam registrados no PR20.

## Retomada de 24/10/2026: retirada de braces e novos advisories

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
foi retirado em 23/10 por não ser explorável na prática. A reexecução completa
do SHA 1b2386b passou Validate, E2E e Firebase, mas a auditoria encontrou
3 altos e 10 moderados novos/remanescentes. Nenhum merge foi feito nesse estado.

O lock foi atualizado somente em caminhos compatíveis:

- body-parser 1.20.8 para 1.20.9 e 2.3.0 para 2.4.0, nas majors exigidas
  por Express/Firebase e pelo SDK MCP.
- undici 6.29.0 para 6.29.1 e 8.11.2 para 8.12.3, dentro dos ranges dos
  consumidores e com suporte ao Node 22.22.2.
- zod 4.4.3 para 4.6.7, fast-uri 3.1.8 para 3.1.9 e ip-address 10.7.3
  para 10.7.4.

Versões, integridades, datas e manifests foram consultados no registro npm
oficial. Firebase CLI permanece em 15.34.0. Manifests de workspace e todas
as versões diretas foram preservados, incluindo Vitest/coverage 4.1.11.
A tentativa de atualizar o par Vitest/coverage encontrou erro interno de
peers no npm 10.6.0; nenhuma alteração parcial dessa tentativa foi publicada.
A resolução apenas transitiva funcionou em diretório isolado e o lock
resultante passou por `npm ci` na toolchain declarada.

Auditoria local: 13 pacotes afetados (3 altos/10 moderados) para 8 moderados,
sem altos, críticos ou baixos. Restam OpenTelemetry/uuid e consumidores
Firebase, além de @vitest/mocker e sua propagação em Vitest/coverage.
O audit-level=high do CI foi preservado; nenhum aviso foi ignorado.

`npm run validate` passou: 115 testes web com cobertura, 38 Functions,
51 contratos, lint, tipos, build e smoke HTTP. Os resultados finais de E2E,
Firebase e CI no SHA publicado ficam registrados no PR20. Merge continua
condicionado a todos os checks verdes, com verificação posterior da principal.
Não houve mudança de produto, interface, permissões ou limites de testes.
