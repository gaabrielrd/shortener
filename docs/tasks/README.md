# Tarefas e planejamento

Esta pasta guarda o planejamento de funcionalidades e tarefas. Cada arquivo descreve uma demanda antes de ela virar código: o que será feito, por quê e como saber que ficou pronta.

Isso ajuda você e os agentes a manterem o foco e o escopo controlado.

## Como usar

- Crie um arquivo por funcionalidade ou tarefa (ex.: `cadastro-de-clientes.md`).
- Preencha o modelo abaixo antes de começar a implementação.
- Atualize o arquivo se o entendimento mudar durante o trabalho.

## Plano do Short Links

O plano completo e sua ordem de dependências estão em
[plano-de-desenvolvimento.md](plano-de-desenvolvimento.md).

| Ordem | Tarefa                                                             | Resultado principal                              |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------ |
| 1     | [Fundação Firebase](0001-fundacao-firebase.md)                     | Backend, emuladores, configuração e contratos    |
| 2     | [Autenticação Google](0002-autenticacao-google.md)                 | Sessão, perfil e rotas protegidas                |
| 3     | [Equipes e contexto ativo](0003-equipes-e-contexto-ativo.md)       | Criação, seleção e associação inicial            |
| 4     | [Membros e permissões](0004-membros-e-permissoes.md)               | Administração e proteção do último administrador |
| 5     | [Convites reutilizáveis](0005-convites-reutilizaveis.md)           | Entrada por link com validade e cancelamento     |
| 6     | [Criação e listagem de links](0006-criacao-e-listagem-de-links.md) | Identificador global, destino e dashboard        |
| 7     | [Ciclo de vida e histórico](0007-ciclo-de-vida-e-historico.md)     | Edição, estados, restauração e auditoria         |
| 8     | [Redirecionamento e contagem](0008-redirecionamento-e-contagem.md) | Rota pública e analytics agregados               |
| 9     | [Analytics e detalhe](0009-analytics-e-detalhe.md)                 | Total, evolução diária e histórico acessível     |
| 10    | [Segurança e entrega piloto](0010-seguranca-e-entrega-piloto.md)   | Regras, E2E, operação e publicação validada      |

## Modelo de arquivo de tarefa

```markdown
# Título da tarefa

## Contexto

Por que isso é necessário e para quem.

## Objetivo

O que se quer alcançar, em uma ou duas frases.

## Escopo

O que faz parte desta tarefa.

## Não escopo

O que fica de fora (para não crescer sem controle).

## Critérios de aceite

- [ ] Condição objetiva 1
- [ ] Condição objetiva 2

## Tarefas

- [ ] Passo 1
- [ ] Passo 2

## Riscos

Dúvidas, dependências ou pontos que podem dar problema.
```
