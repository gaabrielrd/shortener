import { describe, expect, it } from 'vitest';
import { createHealthPayload } from '../src/health.js';

describe('createHealthPayload', () => {
  it('returns the stable infrastructure health contract', () => {
    expect(createHealthPayload()).toEqual({
      service: 'shortener-functions',
      status: 'ok',
    });
  });
});
