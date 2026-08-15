import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import type { DailyClicksDocument, LinkDocument } from './contracts/firestore.js';
import { RESERVED_SLUGS } from './links.js';
import { PUBLIC_REDIRECT_OPTIONS } from './runtime.js';

const PUBLIC_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/;

export const UNAVAILABLE_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Link indisponível</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { display: grid; min-height: 100vh; margin: 0; place-items: center; }
      main { max-width: 34rem; padding: 2rem; text-align: center; }
      h1 { margin: 0 0 0.75rem; }
      p { line-height: 1.5; margin: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>Link indisponível</h1>
      <p>Este endereço não está disponível no momento.</p>
    </main>
  </body>
</html>`;

export const PUBLIC_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
} as const;

export type RedirectResolution =
  { readonly kind: 'redirect'; readonly destinationUrl: string } | { readonly kind: 'unavailable' };

export function utcDay(timestamp: Timestamp): string {
  return timestamp.toDate().toISOString().slice(0, 10);
}

export function publicSlugFromPath(pathname: string): string | null {
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length !== 1) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(pathSegments[0] ?? '').toLowerCase();
  } catch {
    return null;
  }
  if (!PUBLIC_SLUG_PATTERN.test(slug) || RESERVED_SLUGS.has(slug)) return null;
  return slug;
}

function counter(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error('Invalid persisted click counter.');
  }
  return value as number;
}

export async function resolveAndCountRedirect(
  firestore: Firestore,
  input: { readonly slug: string; readonly now: Timestamp },
): Promise<RedirectResolution> {
  const linkReference = firestore.collection('links').doc(input.slug);
  const dayUtc = utcDay(input.now);
  const dailyReference = linkReference.collection('dailyClicks').doc(dayUtc);

  return firestore.runTransaction(async (transaction) => {
    const linkSnapshot = await transaction.get(linkReference);
    if (!linkSnapshot.exists || linkSnapshot.get('status') !== 'active') {
      return { kind: 'unavailable' };
    }

    const link = linkSnapshot.data() as LinkDocument;
    const dailySnapshot = await transaction.get(dailyReference);
    const totalClicks = counter(link.totalClicks) + 1;
    const dailyCount = dailySnapshot.exists ? counter(dailySnapshot.get('count')) + 1 : 1;
    const dailyClicks: DailyClicksDocument = {
      count: dailyCount,
      dayUtc,
      updatedAt: input.now,
    };

    transaction.update(linkReference, { totalClicks });
    transaction.set(dailyReference, dailyClicks);
    return { kind: 'redirect', destinationUrl: link.destinationUrl };
  });
}

function database(): Firestore {
  const app = getApps().length > 0 ? getApp() : initializeApp();
  return getFirestore(app);
}

function setPublicHeaders(response: Parameters<Parameters<typeof onRequest>[0]>[1]): void {
  for (const [name, value] of Object.entries(PUBLIC_RESPONSE_HEADERS)) response.set(name, value);
}

export const redirectLink = onRequest(PUBLIC_REDIRECT_OPTIONS, async (request, response) => {
  setPublicHeaders(response);
  if (request.method !== 'GET') {
    response.set('Allow', 'GET').status(405).type('html').send(UNAVAILABLE_HTML);
    return;
  }

  const slug = publicSlugFromPath(request.path);
  if (slug === null) {
    response.status(404).type('html').send(UNAVAILABLE_HTML);
    return;
  }

  try {
    const result = await resolveAndCountRedirect(database(), { slug, now: Timestamp.now() });
    if (result.kind === 'unavailable') {
      response.status(404).type('html').send(UNAVAILABLE_HTML);
      return;
    }
    response.redirect(302, result.destinationUrl);
  } catch {
    response.status(503).type('html').send(UNAVAILABLE_HTML);
  }
});
