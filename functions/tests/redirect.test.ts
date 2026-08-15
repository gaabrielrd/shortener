import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import {
  PUBLIC_RESPONSE_HEADERS,
  UNAVAILABLE_HTML,
  publicSlugFromPath,
  utcDay,
} from '../src/redirect.js';

describe('public redirect contract', () => {
  it('extracts one valid path segment and compares slug without case', () => {
    expect(publicSlugFromPath('/Campanha-2026')).toBe('campanha-2026');
    expect(publicSlugFromPath('/abc')).toBe('abc');
    expect(publicSlugFromPath('/a'.concat('a'.repeat(49)))).toBe('a'.repeat(50));
  });

  it.each(['/', '/ab', '/app', '/assets', '/one/two', '/com%20espaco', '/%E0%A4%A'])(
    'does not expose invalid or reserved path %s as a link',
    (path) => expect(publicSlugFromPath(path)).toBeNull(),
  );

  it('derives the calendar day in UTC at date boundaries', () => {
    expect(utcDay(Timestamp.fromDate(new Date('2026-08-15T23:59:59.999Z')))).toBe('2026-08-15');
    expect(utcDay(Timestamp.fromDate(new Date('2026-08-16T00:00:00.000Z')))).toBe('2026-08-16');
  });

  it('uses a generic accessible page and prevents durable caching and referrer disclosure', () => {
    expect(UNAVAILABLE_HTML).toContain('<html lang="pt-BR">');
    expect(UNAVAILABLE_HTML).toContain('<h1>Link indisponível</h1>');
    expect(UNAVAILABLE_HTML).not.toMatch(/destino|equipe|criador/i);
    expect(PUBLIC_RESPONSE_HEADERS['Cache-Control']).toContain('no-store');
    expect(PUBLIC_RESPONSE_HEADERS['Referrer-Policy']).toBe('no-referrer');
  });
});
