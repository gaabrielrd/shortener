# Operação e entrega do piloto

## Produção aprovada

- Projeto Firebase: `shortener-59c85`.
- Firestore: Native/Standard em `southamerica-east1` (São Paulo).
- Functions: Node 22, 2ª geração, `southamerica-east1`.
- Hosting inicial: `https://shortener-59c85.web.app`.
- Domínio curto customizado: opcional depois do piloto; ao adotá-lo, atualizar
  `VITE_PUBLIC_SHORT_BASE_URL`, domínios autorizados do Auth e DNS.

## Provisionamento antes do primeiro deploy

1. Confirmar plano com faturamento compatível com Cloud Functions e criar um
   orçamento mensal com alertas progressivos (por exemplo 50%, 80% e 100%).
2. No Authentication, habilitar somente Google e autorizar
   `shortener-59c85.web.app`, `shortener-59c85.firebaseapp.com` e o futuro
   domínio curto. Manter o `authDomain` fornecido pelo Firebase; o cliente usa
   popup e não exige URI OAuth adicional para o domínio `web.app`. Não habilitar
   senha nem anônimo.
3. Confirmar o Firestore em `southamerica-east1`; a localização não pode ser
   alterada depois. Não criar banco de teste no projeto real.
4. Registrar App Check para o app Web e observar métricas das callables antes de
   decidir enforcement. Não aplicar App Check ao redirect público.
5. No Cloud Logging, escolher retenção operacional mínima e evitar sinks com
   URL completa. Alertar aumento de `5xx`, `429` e latência do redirect.
6. Criar `.env.local` ignorado pelo Git com a configuração pública do app e
   `VITE_PUBLIC_SHORT_BASE_URL=https://shortener-59c85.web.app`.

## Gates e deploy em ordem segura

```bash
npm ci
npm run validate
npm run test:firebase
npm run test:e2e
npm audit --audit-level=high
npm run build:bundle
firebase deploy --project shortener-59c85 --only firestore:rules,firestore:indexes
firebase deploy --project shortener-59c85 --only functions
firebase deploy --project shortener-59c85 --only hosting
```

Rules e índices entram primeiro, Functions depois e Hosting/rewrite por último.
Não executar deploy a partir de um bundle criado com valores `demo-`.
As rotas HTML da SPA usam `no-cache, no-store, must-revalidate` para que um
deploy de autenticação ou segurança não permaneça oculto pelo cache de uma aba;
assets com hash mantêm o comportamento padrão do CDN.

## Smoke pós-deploy

1. Abrir `/login`, entrar com Google e confirmar perfil sem erro.
2. Criar uma equipe controlada, um convite curto e uma segunda conta membro.
3. Criar um slug de smoke com destino controlado; copiar e abrir três vezes com
   redirect manual, conferindo `302`, `Location`, `Cache-Control: no-store` e
   início abaixo de 1 segundo com Function aquecida.
4. Confirmar total/dia 3 no detalhe, editar destino e validar que o quarto clique
   usa o destino novo sem zerar analytics.
5. Desativar e arquivar; ambos devem mostrar o mesmo “Link indisponível”.
6. Confirmar que membro não vê link alheio e administrador vê todos.
7. Arquivar os artefatos de smoke, identificá-los como teste e registrar a
   evidência em [pilot-evidence.md](pilot-evidence.md).

## Rollback

- **Hosting:** no Console Firebase, restaurar a versão anterior do canal live.
- **Functions:** voltar ao commit anterior, recompilar e redeployar somente
  `functions`; não mudar região durante incidente.
- **Rules:** redeployar o arquivo anterior imediatamente. Nunca abrir acesso como
  mitigação temporária.
- **Índices:** são aditivos no rollout. Não excluir durante incidente; remover
  só após confirmar que nenhuma versão ativa consulta o índice.
- Depois do rollback, repetir smoke público e autenticado e registrar impacto.

## Primeiro mês

No primeiro e no último dia, registrar uma agregação `count()` da coleção
`links` filtrada pela equipe piloto e descontar slugs marcados no registro de
smoke. A meta é pelo menos 20 links criados. Não consultar `dailyClicks` para
essa métrica e não acrescentar eventos de visitante.

Uma falha crítica é qualquer período em que link ativo não redirecione, clique
confirmado não seja contado ou pessoa sem permissão leia/administre dados.
Registrar início, fim, impacto agregado e ação corretiva, sem URL de convite,
IP ou identidade de visitante. Alertas de orçamento e retenção são configurações
do Console e devem ser marcados no checklist, nunca exportados como segredo.
