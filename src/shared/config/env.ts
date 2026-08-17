/**
 * Leitura tipada e validada das variaveis de ambiente.
 *
 * O Vite injeta `import.meta.env` estaticamente no build. Sem validacao, uma
 * variavel ausente ou malformada vira `undefined` e so aparece muito depois,
 * como um erro sem relacao aparente. Aqui a configuracao falha no boot, com
 * mensagem que diz exatamente qual variavel corrigir.
 *
 * Para exigir uma variavel nova, acrescente a chave em `REQUIRED_KEYS` e
 * exponha o valor em `Env`. Lembre-se: tudo que chega ao browser e publico,
 * entao nunca coloque segredos aqui.
 */

/** Variaveis sem as quais a aplicacao nao deve subir. */
const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_PUBLIC_SHORT_BASE_URL',
] as const;

export interface FirebaseEnv {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly storageBucket: string;
  readonly messagingSenderId: string;
  readonly appId: string;
  readonly measurementId: string | undefined;
  readonly useEmulators: boolean;
}

export interface Env {
  /** Modo do Vite: `development`, `production` ou um modo customizado. */
  readonly mode: string;
  readonly isProduction: boolean;
  /** Base da API, quando o projeto usa uma. */
  readonly apiUrl: string | undefined;
  readonly publicShortBaseUrl: string;
  readonly googleClientId: string | undefined;
  readonly firebase: FirebaseEnv;
}

function readRequired(raw: ImportMetaEnv, key: (typeof REQUIRED_KEYS)[number]): string {
  return readOptional(raw, key) ?? '';
}

function readBoolean(
  raw: ImportMetaEnv,
  key: string,
  problems: string[],
  fallback: boolean,
): boolean {
  const value = readOptional(raw, key);
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  problems.push(`${key} deve ser "true" ou "false". Recebido: "${value}".`);
  return fallback;
}

export class EnvValidationError extends Error {
  constructor(problems: readonly string[]) {
    super(
      `Configuracao de ambiente invalida:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
        'Copie .env.example para .env.local e preencha os valores.',
    );
    this.name = 'EnvValidationError';
  }
}

function readOptional(raw: ImportMetaEnv, key: string): string | undefined {
  // `ImportMetaEnv` traz um index signature `any` vindo de vite/client;
  // estreitar para `unknown` mantem a leitura segura.
  const value: unknown = (raw as Record<string, unknown>)[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function readUrl(raw: ImportMetaEnv, key: string, problems: string[]): string | undefined {
  const value = readOptional(raw, key);
  if (value === undefined) return undefined;

  try {
    // Normaliza e rejeita valores que nao sao URL absoluta.
    return new URL(value).toString().replace(/\/$/, '');
  } catch {
    problems.push(`${key} deve ser uma URL absoluta. Recebido: "${value}".`);
    return undefined;
  }
}

function readHttpUrl(raw: ImportMetaEnv, key: string, problems: string[]): string | undefined {
  const value = readUrl(raw, key, problems);
  if (value === undefined) return undefined;
  const protocol = new URL(value).protocol;
  if (protocol !== 'http:' && protocol !== 'https:') {
    problems.push(`${key} deve começar por http:// ou https://. Recebido: "${value}".`);
    return undefined;
  }
  return value;
}

/**
 * Monta o objeto de configuracao a partir de um `import.meta.env`.
 * Exportado separadamente para permitir teste sem depender do ambiente real.
 *
 * @throws {EnvValidationError} quando alguma variavel esta ausente ou invalida
 */
export function createEnv(raw: ImportMetaEnv): Env {
  const problems: string[] = [];

  for (const key of REQUIRED_KEYS) {
    if (readOptional(raw, key) === undefined) {
      problems.push(`${key} e obrigatoria e nao foi definida.`);
    }
  }

  const apiUrl = readUrl(raw, 'VITE_API_URL', problems);
  const publicShortBaseUrl = readHttpUrl(raw, 'VITE_PUBLIC_SHORT_BASE_URL', problems) ?? '';
  const googleClientId = readOptional(raw, 'VITE_GOOGLE_CLIENT_ID');
  const useEmulators = readBoolean(raw, 'VITE_FIREBASE_USE_EMULATORS', problems, false);

  if (problems.length > 0) throw new EnvValidationError(problems);

  return {
    mode: raw.MODE,
    isProduction: raw.PROD,
    apiUrl,
    publicShortBaseUrl,
    googleClientId,
    firebase: {
      apiKey: readRequired(raw, 'VITE_FIREBASE_API_KEY'),
      authDomain: readRequired(raw, 'VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: readRequired(raw, 'VITE_FIREBASE_PROJECT_ID'),
      storageBucket: readRequired(raw, 'VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: readRequired(raw, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: readRequired(raw, 'VITE_FIREBASE_APP_ID'),
      measurementId: readOptional(raw, 'VITE_FIREBASE_MEASUREMENT_ID'),
      useEmulators,
    },
  };
}

export const env: Env = createEnv(import.meta.env);
