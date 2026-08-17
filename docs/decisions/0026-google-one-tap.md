# ADR 0026: autenticação Google One Tap in-page com fallback por popup

## Status

Aceita. Complementa a [ADR 0025](0025-google-authentication-popup.md).

## Contexto

A [ADR 0025](0025-google-authentication-popup.md) estabeleceu a autenticação via `signInWithPopup` para evitar redirecionamentos completos da página e contornar bloqueios de cookies de terceiros.

Contudo, para usuários que já possuem conta Google conectada no navegador, a experiência pode ser ainda mais rápida e fluida através do Google Identity Services (GIS) / Google One Tap, que permite autenticação com um único clique em um prompt in-page gerenciado pelo Google, sem abrir novas janelas.

## Decisão

- Adotar o Google One Tap (Google Identity Services) como experiência primária de login in-page na tela de entrada (`/login`).
- Configurar o Web Client ID do Google OAuth pela variável de ambiente opcional `VITE_GOOGLE_CLIENT_ID`.
- Quando `VITE_GOOGLE_CLIENT_ID` estiver ausente ou quando emuladores estiverem ativos (`VITE_FIREBASE_USE_EMULATORS=true`), desabilitar o prompt One Tap silenciosamente.
- Quando o usuário selecionar uma conta no One Tap, converter o token ID em credencial via `GoogleAuthProvider.credential(idToken)` e autenticar com `signInWithCredential`.
- Manter o botão "Entrar com Google" (`signInWithPopup`) na interface para servir como fallback garantido em casos onde o One Tap for cancelado, bloqueado ou indisponível.
- Fazer cleanup e cancelamento do prompt (`google.accounts.id.cancel()`) quando a tela de login for desmontada ou o estado mudar.

## Consequências

- Usuários com conta Google no navegador realizam login instantâneo sem sair da página e sem abertura de janelas extras.
- Casos em que o usuário precisa digitar credenciais manualmente ou alternar contas que não aparecem no One Tap continuam cobertos pelo popup.
- A integridade do pipeline de autenticação (`onAuthStateChanged`, `ensureUserProfile`, sanitização de rotas) permanece 100% reutilizada e idêntica entre os dois fluxos.
- Os testes unitários cobrem tanto o fluxo One Tap quanto o fluxo de popup e seus cenários de falha.
