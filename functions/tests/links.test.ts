import { describe, expect, it } from 'vitest';
import { nextLinkStatus, normalizeDestinationUrl, normalizeLinkSlug } from '../src/links.js';

describe('links', () => {
  it('normaliza caixa e espaços antes de reservar o slug', () => {
    expect(normalizeLinkSlug('  Campanha-2026  ')).toBe('campanha-2026');
    expect(normalizeLinkSlug('abc')).toBe('abc');
    expect(normalizeLinkSlug('a'.repeat(50))).toBe('a'.repeat(50));
  });

  it.each([undefined, '', 'ab', 'a'.repeat(51), '-inicio', 'fim-', 'com espaço', 'ação'])(
    'recusa slug inválido %s',
    (slug) => expect(() => normalizeLinkSlug(slug)).toThrow(/slug|letras|minúsculas/i),
  );

  it.each(['app', 'API', ' styleguide ', 'invite', 'assets'])('recusa rota reservada %s', (slug) =>
    expect(() => normalizeLinkSlug(slug)).toThrow(/reservado/i),
  );

  it('aceita somente destinos HTTP e HTTPS absolutos e os normaliza', () => {
    expect(normalizeDestinationUrl('https://example.com/caminho?q=1')).toBe(
      'https://example.com/caminho?q=1',
    );
    expect(normalizeDestinationUrl('http://example.com')).toBe('http://example.com/');
    for (const destination of [
      '',
      '/relativo',
      'example.com',
      'javascript:alert(1)',
      'ftp://x.test',
    ]) {
      expect(() => normalizeDestinationUrl(destination)).toThrow(/http/i);
    }
  });

  it('define transições e recusa desativar um link arquivado', () => {
    expect(nextLinkStatus('active', 'disable')).toBe('disabled');
    expect(nextLinkStatus('disabled', 'disable')).toBe('disabled');
    expect(nextLinkStatus('active', 'archive')).toBe('archived');
    expect(nextLinkStatus('disabled', 'archive')).toBe('archived');
    expect(nextLinkStatus('archived', 'restore')).toBe('active');
    expect(() => nextLinkStatus('archived', 'disable')).toThrow(/restaure/i);
  });
});
