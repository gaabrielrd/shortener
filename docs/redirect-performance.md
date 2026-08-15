# Evidência de desempenho do redirecionamento

## Meta

O redirecionamento deve começar em até 1 segundo em condições normais.

## Medição local

- Data: 15 de agosto de 2026.
- Ambiente: Firebase Hosting, Functions e Firestore Emulators no mesmo
  computador, com a Function já aquecida.
- Método: uma chamada de aquecimento seguida por `GET` com redirect manual; o
  relógio engloba Hosting, Function, transação e recebimento do `302`.
- Resultado observado mais recente: **72,2 ms**.
- Limite automatizado: o smoke falha acima de 1.000 ms.

O resultado prova o caminho normal local, não a latência de cold start nem da
rede pública. A entrega piloto deve repetir a mesma medição no domínio publicado
e registrar região, condição quente/fria e resultado antes de liberar usuários.

## Medição pública preliminar

- Data: 15 de agosto de 2026, imediatamente após o primeiro deploy.
- Ambiente: Hosting e Functions de produção em `southamerica-east1`.
- Método: `GET` manual para um slug inexistente, exercitando Hosting, Function e
  consulta ao Firestore sem criar ou alterar dados.
- Primeira chamada observada: **928,3 ms**.
- Três chamadas aquecidas: **422,6 ms**, **484,4 ms** e **418,9 ms**.
- Resultado: todos os tempos ficaram abaixo de 1.000 ms; a resposta foi `404`
  genérica com `Cache-Control: no-store` e `Referrer-Policy: no-referrer`.

Esta medição confirma o caminho público de indisponibilidade, mas não substitui
o smoke de um link ativo com transação de contagem e resposta `302`. Esse valor
será registrado após a autenticação da conta de smoke.

## Capacidade e falhas

A integração também envia uma rajada de oito cliques concorrentes e confirma os
oito incrementos no total e no documento diário. Uma tentativa com 25
transações simultâneas atingiu o timeout de lock do emulador: nenhuma resposta
deve redirecionar quando a contagem não for confirmada. Carga sustentada que
revele esse limite em produção exige reavaliar o modelo, por exemplo com
contadores distribuídos, antes de aumentar tráfego.
