import { describe, expect, it } from 'vitest';
import {
  historyActionLabel,
  normalizeSlug,
  statusLabel,
  validateDestinationUrl,
  validateSlug,
} from '../model/link';
import type { LinkHistoryAction, LinkStatus } from '../model/link';

describe('modelo de links', () => {
  it('normaliza o slug de forma determinística', () => {
    expect(normalizeSlug('  Campanha-2026 ')).toBe('campanha-2026');
  });

  it.each(['abc', 'campanha-2026', 'a'.repeat(50)])('aceita slug %s', (slug) => {
    expect(validateSlug(slug)).toBeNull();
  });

  it.each(['', 'ab', '-inicio', 'fim-', 'com espaço', 'ação', 'a'.repeat(51)])(
    'recusa formato de slug %s',
    (slug) => expect(validateSlug(slug)).toMatchObject({ field: 'slug' }),
  );

  it.each(['app', 'API', ' styleguide '])('recusa rota reservada %s', (slug) => {
    expect(validateSlug(slug)?.message).toMatch(/reservado/i);
  });

  it('aceita HTTP/HTTPS absolutos e recusa destinos relativos ou perigosos', () => {
    expect(validateDestinationUrl('https://example.com/path')).toBeNull();
    expect(validateDestinationUrl('http://example.com')).toBeNull();
    for (const destination of ['/path', 'example.com', 'javascript:alert(1)', 'ftp://x.test']) {
      expect(validateDestinationUrl(destination)).toMatchObject({ field: 'destinationUrl' });
    }
  });

  it('expõe rótulos textuais para todos os estados e eventos', () => {
    const statuses: LinkStatus[] = ['active', 'disabled', 'archived'];
    const actions: LinkHistoryAction[] = [
      'created',
      'destination_changed',
      'disabled',
      'archived',
      'restored',
    ];
    expect(statuses.map(statusLabel)).toEqual(['Ativo', 'Desativado', 'Arquivado']);
    expect(actions.map(historyActionLabel)).toEqual([
      'Link criado',
      'Destino alterado',
      'Link desativado',
      'Link arquivado',
      'Link restaurado',
    ]);
  });
});
