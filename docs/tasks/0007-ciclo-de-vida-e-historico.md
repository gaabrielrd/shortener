# 0007 — Ciclo de vida e histórico do link

**Status:** concluída em 2026-08-15  
**Dependências:** 0006  
**Rastreabilidade:** RF-07, RF-08, RF-11, RN-11, RN-12, RN-13, RN-15, CA-12, CA-13

## Contexto e objetivo

Links precisam mudar de destino e estado sem perder endereço, analytics ou
rastreabilidade. Esta tarefa entrega edição ilimitada, desativação, arquivamento,
restauração e histórico imutável.

## Requisitos

- Criador ou administrador altera destino e estado; outros usuários são negados.
- Estados mínimos: ativo, desativado e arquivado.
- Restaurar um arquivado o torna ativo novamente.
- Slug nunca muda, expira ou volta a ficar disponível.
- Cada mutação registra ação, autor, timestamp do servidor e valores anterior/novo.
- Histórico é paginado e não pode ser editado ou apagado pelo cliente.

## Não escopo

- Exclusão definitiva, mudança de slug, expiração automática ou transferência
  entre equipes.
- Separar analytics por versão do destino.

## Suposições

- “Excluir” na interface será apresentado como arquivar, com confirmação e
  possibilidade explícita de restaurar.
- Operação repetida para o mesmo estado retorna resultado idempotente sem criar
  histórico enganoso.

## Proposta de solução

Functions transacionais atualizam o link e acrescentam histórico imutável. O
modelo define transições válidas; a lista recebe filtro por estado e o detalhe
expõe ações conforme permissão.

## Módulos e arquivos previstos

- feature `links`: modelo de estado, serviços, detalhe, histórico e diálogos.
- Functions de edição e mudança de estado.
- subcoleção `history`, índices, Rules e paginação.
- testes de transição, autorização, concorrência e interface.

## Tarefas sequenciais

- [x] Definir máquina de estados e eventos de histórico.
- [x] Implementar edição transacional do destino com validação HTTP/HTTPS.
- [x] Implementar desativar, arquivar e restaurar com idempotência.
- [x] Impedir qualquer alteração ou reutilização do slug.
- [x] Implementar leitura paginada do histórico para criador/administrador.
- [x] Criar detalhe, formulário e confirmações com feedback de persistência.
- [x] Adicionar filtro de estado que permita encontrar arquivados.
- [x] Testar concorrência, sessão expirada, alvo inexistente e acesso negado.
- [x] Atualizar E2E e documentação.

## Riscos

- Atualizar link e falhar ao gravar histórico.
- Duplo clique gerar eventos duplicados.
- Histórico ilimitado tornar a consulta inicial pesada.
- “Excluir” sugerir remoção definitiva contrária ao PRD.

## Critérios de aceite

- [x] Alterar destino preserva slug e dados existentes.
- [x] Toda alteração real possui evento imutável com autor, data e valores.
- [x] Desativado/arquivado deixa de estar ativo; restaurado volta ao mesmo slug.
- [x] Slug arquivado continua recusado para novas criações.
- [x] Histórico é paginado e visível somente ao criador ou administrador.
- [x] Testes de Functions/Rules, componentes e `npm run validate` passam.

## Validação e documentação

- Testes de unidade da máquina de estados e integração transacional.
- E2E de editar, desativar, arquivar, localizar e restaurar.
- Atualizar modelo de dados, retenção e linguagem da interface.
