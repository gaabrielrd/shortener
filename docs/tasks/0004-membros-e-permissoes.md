# 0004 — Membros e permissões

**Status:** concluída em 2026-08-15  
**Dependências:** 0003  
**Rastreabilidade:** RF-03, RN-04, RN-06, RN-07, CA-10, CA-11, CA-14

## Contexto e objetivo

A equipe precisa de níveis administrador e membro aplicados pelo backend. Esta
tarefa entrega gestão de membros e protege a continuidade da administração.

## Requisitos

- Administrador lista membros, promove, rebaixa e remove.
- Membro comum não recebe nem executa ações administrativas.
- O último administrador não pode sair, ser removido ou rebaixado.
- Remoção encerra acesso imediatamente.
- Links permanecem pertencendo à equipe após a saída do criador.
- Alterações concorrentes preservam ao menos um administrador.

## Não escopo

- Níveis adicionais, grupos de permissão ou transferência de links entre equipes.
- Exclusão da equipe.
- Convites, que entram na tarefa 0005.

## Suposições

- Pode haver vários administradores.
- A lista de membros guarda snapshot mínimo de nome/e-mail para exibição e
  auditoria, sem conceder leitura global da coleção de usuários.

## Proposta de solução

Usar Functions transacionais para mudanças de nível, remoção e saída. Rules
permitem leitura aos membros da equipe, mas negam mutações diretas. A interface
deriva capacidades do nível atual e sempre trata recusa do backend.

## Módulos e arquivos previstos

- feature `teams`: modelos, serviços, tela de membros e ações administrativas.
- Functions `changeMemberRole`, `removeMember` e `leaveTeam` ou equivalentes.
- Rules e testes de concorrência no Firestore Emulator.
- componentes `Dialog`, `Alert`, `Table`, estados de dados e testes.

## Tarefas sequenciais

- [x] Formalizar matriz administrador/membro para equipes e links.
- [x] Implementar leitura autorizada da lista de membros.
- [x] Implementar promoção/rebaixamento transacional.
- [x] Implementar remoção e saída com verificação do último administrador.
- [x] Invalidar/atualizar o contexto ativo quando a associação termina.
- [x] Construir tela de membros e confirmações para ações destrutivas.
- [x] Cobrir tentativa de membro, alvo inexistente, concorrência e sessão vencida.
- [x] Confirmar que links do membro removido permanecem administráveis.
- [x] Atualizar documentação e E2E incremental.

## Riscos

- Race condition deixar uma equipe sem administrador.
- Interface esconder ação, mas Rules ainda permitirem a escrita.
- Perfil de membro expor dados fora da equipe.

## Critérios de aceite

- [x] Administrador gerencia membros e membro comum não consegue fazê-lo.
- [x] O último administrador permanece protegido inclusive em requisições
      concorrentes.
- [x] Removido perde leitura/escrita imediatamente.
- [x] Administradores continuam controlando links de quem saiu.
- [x] Erros e confirmações são acessíveis e observáveis.
- [x] Testes de Rules/Functions e `npm run validate` passam.

## Validação e documentação

- Testes de matriz de permissão, transações, componente e concorrência.
- E2E com dois usuários e mudança de nível.
- Atualizar matriz de autorização e fluxo de saída na arquitetura.
