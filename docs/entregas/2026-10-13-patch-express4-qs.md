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
