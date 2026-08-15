# 0005 — Convites reutilizáveis

**Status:** concluída em 2026-08-15  
**Dependências:** 0004  
**Rastreabilidade:** RF-04, RN-05, CA-03, CA-04

## Contexto e objetivo

Administradores precisam convidar várias pessoas por um link não vinculado a
e-mail. O convite deve funcionar até a validade escolhida ou cancelamento.

## Requisitos

- Somente administrador cria, lista e cancela convites.
- Validade é obrigatória e precisa estar no futuro.
- Um mesmo convite adiciona vários usuários autenticados antes de expirar.
- Token é opaco, não aparece em logs e só seu hash fica persistido.
- A rota de convite preserva o token durante o login Google.
- Entrar novamente na mesma equipe é idempotente.

## Não escopo

- Envio de e-mail, vínculo com destinatário, limite de usos ou aprovação manual.
- Convite para nível administrador; novos participantes entram como membros.

## Suposições

- A validade é informada como data/hora e persistida como timestamp UTC.
- Cancelamento não remove associações já criadas.

## Proposta de solução

Gerar token criptograficamente aleatório no backend, persistir hash e retornar o
token apenas na criação. Uma Function pública autenticada valida hash, estado e
tempo em transação antes de criar a associação. A tela administrativa lista
metadados, não o segredo recuperável.

## Módulos e arquivos previstos

- feature `teams`: serviços/componentes de convites e rota `/invite/:token`.
- Functions de criar, cancelar e consumir convite.
- coleção `inviteTokens`, Rules fechadas e testes no Emulator Suite.
- testes de relógio, concorrência, login e cópia do link.

## Tarefas sequenciais

- [x] Definir estados ativo, vencido e cancelado e erros estáveis.
- [x] Implementar geração de token, hash e validação de data futura.
- [x] Implementar consumo autenticado, reutilizável e idempotente em transação.
- [x] Implementar cancelamento administrativo.
- [x] Criar tela de convites com validade, cópia e estados explícitos.
- [x] Criar rota pública de convite com retorno após login.
- [x] Impedir exposição de token em logs, analytics, listas ou mensagens de erro.
- [x] Testar múltiplos usuários, uso repetido, expiração, cancelamento e negações.
- [x] Atualizar E2E e documentação operacional.

## Riscos

- Token curto ou registrado em logs permitir entrada indevida.
- Condições de corrida criarem associações duplicadas.
- Diferença de relógio entre cliente e servidor; o servidor deve decidir.
- URL de convite ser confundida com slug público.

## Critérios de aceite

- [x] Vários usuários autenticados entram como membros pelo mesmo convite ativo.
- [x] Convite vencido, cancelado ou inválido nunca cria associação.
- [x] Membro já associado recebe resultado idempotente.
- [x] Somente administrador cria/cancela e o token não fica armazenado em claro.
- [x] Fluxo login → retorno → entrada funciona em mobile e desktop.
- [x] Testes com relógio controlado e `npm run validate` passam.

## Validação e documentação

- Testes unitários de token/estado, Functions/Rules e componente.
- E2E multiusuário via Auth Emulator.
- Documentar risco de compartilhamento, cancelamento e retenção do convite.
