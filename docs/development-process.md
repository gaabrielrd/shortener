# Processo de desenvolvimento

Fluxo recomendado para levar uma ideia até o código, de forma organizada e verificável.

## Fluxo

1. **Descoberta do produto**: se a ideia ainda estiver vaga, use `plan-app`. Responda às perguntas até aprovar um escopo e um não escopo completos em `prd.md`.
2. **Demanda**: escolha uma capacidade aprovada no PRD e descreva o que se quer resolver e para quem.
3. **Especificação**: detalhe o comportamento esperado, entradas e saídas.
4. **Critérios de aceite**: liste, de forma objetiva, o que precisa ser verdade para a demanda estar pronta.
5. **Planejamento**: quebre em passos. Você pode pedir ao agente: "Use a skill plan-feature...".
6. **Branch**: crie uma branch para o trabalho (`git checkout -b feat/descricao`).
7. **Implementação**: escreva o código seguindo a [arquitetura](architecture.md).
8. **Validação local**: rode `npm run validate` até ficar tudo verde. Em mudanças de interface, resolva também os avisos de `npm run check:styleguide`.
9. **Commit**: registre as mudanças com mensagem clara.
10. **Pull Request**: abra o PR descrevendo o que mudou e por quê.
11. **Revisão**: ajuste conforme os comentários antes de integrar.

Atualizações herdadas do template usam `npm run update:template -- --dry-run`
antes da aplicação. Veja [updating.md](updating.md).

## Mensagens de commit

Use um prefixo de tipo:

```
feat: adiciona filtro de busca na lista de clientes
fix: corrige data exibida no formato errado
docs: documenta como configurar variáveis de ambiente
```

Outros prefixos úteis: `test:`, `refactor:`, `chore:`, `perf:`, `build:`, `ci:`, `style:`, `revert:`. Um escopo entre parênteses é opcional (`fix(notes): ...`), e `!` marca mudança incompatível (`feat!: ...`).

A convenção é verificada pelo hook `commit-msg` (`scripts/check-commit-message.mjs`): a primeira linha precisa seguir `tipo: descrição`, ter no máximo 72 caracteres e não terminar com ponto. Commits de merge, revert e `fixup!` são ignorados.

## Verificação automática

| Momento      | O que roda                                              |
| ------------ | ------------------------------------------------------- |
| `pre-commit` | `lint-staged` nos arquivos alterados                    |
| `commit-msg` | Convenção da mensagem                                   |
| `pre-push`   | `typecheck` e `test:unit` (Vitest sem cobertura)        |
| Pull Request | `validate` em Node 22.22.2, auditoria e E2E no Chromium |

Os hooks são atalhos para pegar o problema cedo; corrija a causa quando um deles
falhar. O CI executa os portões completos e é a fonte da verdade.

## Definição de concluído

Uma tarefa está concluída quando:

- Os critérios de aceite foram atendidos
- Funciona localmente
- Os testes passam
- Não há erro de lint, typecheck ou build (`npm run validate` verde)
- O CI está verde no Pull Request
- A documentação foi atualizada quando necessário
- As alterações estão registradas no Git

## Atualizações de segurança de dependências

O lockfile mantém correções compatíveis de dependências transitivas sem reduzir
os gates de auditoria, cobertura ou testes. Não use `npm audit fix --force` para
resolver um alerta: o npm pode sugerir downgrades incompatíveis de Firebase.

Vitest e `@vitest/coverage-v8` são atualizados juntos na linha major 4. A versão
mínima `4.1.11` inclui a correção de GHSA-82fw-gwwq-j7x9 em `@vitest/mocker`,
também adotada pelo workspace Functions. Confira a árvore instalada e execute
os gates existentes após regenerar o lockfile com a versão declarada do npm.

TypeScript na raiz e em Functions permanece em `6.0.3`, dentro das faixas
declaradas nos manifests. O lockfile não deve introduzir outra versão principal
fora dessas faixas, mesmo quando a instalação termina sem erro.

O override de `@grpc/grpc-js` para `1.13.6` é limitado a
`@firebase/firestore`, que ainda declara `~1.9.0`. Essa versão permanece na linha
major 1 e corrige os avisos GHSA-m9gg-hp2v-232j e GHSA-f596-whhp-79r4. A mudança
precisa passar pelas integrações Firebase e pela regressão do transporte Node.
Remova o override quando o SDK adotar uma faixa corrigida compatível.

O alerta GHSA-vfj7-8cjw-p6xm de `braces`, transitivo de `chokidar` usado pelo
Firebase CLI, ainda não possui release corrigida publicada. A auditoria deve
continuar falhando enquanto essa dependência vulnerável estiver presente; não
suprima o aviso nem substitua majors fora das faixas suportadas apenas para
liberar o merge.
