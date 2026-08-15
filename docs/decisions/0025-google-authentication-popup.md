# ADR 0025: autenticação Google por popup

## Status

Aceita. Substitui a [ADR 0016](0016-google-authentication.md).

## Contexto

O primeiro deploy usou `signInWithRedirect` e devolveu a pessoa para a tela de
entrada. Em navegadores com armazenamento entre origens bloqueado, o SDK perdeu
o estado do redirect quando a SPA em `web.app` usava o helper padrão em
`firebaseapp.com`. Mover o helper para `web.app` exigiria manter uma URI adicional
no cliente OAuth e o primeiro smoke encontrou `redirect_uri_mismatch`.

O produto quer manter a pessoa na tela de entrada enquanto ela escolhe a conta
Google e já possui uma ação explícita capaz de abrir uma janela auxiliar.

## Decisão

- Usar `signInWithPopup` com `GoogleAuthProvider` e seleção explícita de conta.
- Não processar `getRedirectResult` na inicialização da aplicação.
- Preservar a rota interna sanitizada até `onAuthStateChanged` confirmar a sessão
  e `ensureUserProfile` preparar o perfil.
- Traduzir popup fechado, bloqueado, falha de rede e falha do provedor em estados
  recuperáveis na tela de entrada.
- Manter o `authDomain` padrão `firebaseapp.com` e os domínios que servem a SPA
  autorizados no Firebase Authentication.

## Consequências

- A SPA não navega para o provedor durante o login e não depende de armazenamento
  de terceiros para recuperar o resultado.
- As rotas HTML não são mantidas no cache do navegador entre deploys; assets com
  hash continuam independentes e podem ser cacheados pelo Hosting.
- O popup precisa nascer diretamente do clique/tecla da pessoa; extensões ou
  políticas do navegador ainda podem bloqueá-lo e a interface permite repetir.
- O E2E precisa controlar a janela auxiliar do Auth Emulator e confirmar que a
  página original permanece na rota pretendida.
- Sessões válidas continuam restauradas pela persistência local do Firebase;
  autorização e criação do perfil permanecem inalteradas.
