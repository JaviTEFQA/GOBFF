import { expect, test } from '@playwright/test';
import { endpointId, endpointSlug, isCanowayUrl, requestKey } from '../../src/catalog/endpoint-id';

const BASE = 'https://canoway-de.cdn.telefonica.com/instance/45/service';

test.describe('endpoint-id', () => {
  test('templates ids out of the path', () => {
    expect(endpointId('get', `${BASE}/nsh/unified-detailed-content/MOV44943332`)).toBe('GET nsh/unified-detailed-content/{pid}');
    expect(endpointId('GET', `${BASE}/nsh/thematic-site-page/CHA14798?page=1`)).toBe('GET nsh/thematic-site-page/{pid}');
    expect(endpointId('GET', `${BASE}/nsh/users/123456789/homezone/check`)).toBe('GET nsh/users/{id}/homezone/check');
    expect(endpointId('GET', `${BASE}/instances/45/thumbnails`)).toBe('GET instances/45/thumbnails');
    expect(endpointId('GET', `${BASE}/thematic-site-page-prio-long-name`)).toBe('GET thematic-site-page-prio-long-name');
    expect(endpointId('GET', `${BASE}/session/aB3dE5fG7hJ9kL1mN3pQ5rS7tU9`)).toBe('GET session/{token}');
    expect(endpointId('POST', 'https://canoway-plat-de.gvp.telefonica.com/instance/45/service/events/bbob/ott/audience')).toBe('POST events/bbob/ott/audience');
  });

  test('recognises canoway hosts only', () => {
    expect(isCanowayUrl(`${BASE}/nsh/home`)).toBe(true);
    expect(isCanowayUrl('https://canoway-plat-de.gvp.telefonica.com/x')).toBe(true);
    expect(isCanowayUrl('https://spotlight-de.cdn.telefonica.com/img.jpg')).toBe(false);
    expect(isCanowayUrl('https://evil.com/canoway-de.cdn.telefonica.com')).toBe(false);
  });

  test('request key ignores query order, cache busters and dates', () => {
    const a = requestKey('GET', `${BASE}/nsh/epg?to=2026-10-21T00:00:00Z&channel=CHA1&_=123&from=1760954400000`);
    const b = requestKey('GET', `${BASE}/nsh/epg?from=1762500000000&channel=CHA1&to=2026-11-08T00:00:00Z`);
    expect(a).toBe(b);
    expect(a).toBe('GET nsh/epg?channel=CHA1&from={date}&to={date}');
  });

  test('slug is filesystem safe', () => {
    expect(endpointSlug('GET nsh/unified-detailed-content/{pid}')).toBe('GET__nsh_unified-detailed-content_pid');
    expect(endpointSlug('GET blender/service3.0')).toBe('GET__blender_service3_0');
  });
});

test('appRoute keeps the app sub-path', async () => {
  const { appRoute, env } = await import('../../src/config/env');
  const original = env.appUrl;
  try {
    (env as { appUrl: string }).appUrl = 'https://deploy.mca.tid.es/nightly/release/26.10.x-production-de-de/';
    expect(appRoute('/catalog/mediathek-14798')).toBe('https://deploy.mca.tid.es/nightly/release/26.10.x-production-de-de/catalog/mediathek-14798');
    expect(appRoute('/')).toBe('https://deploy.mca.tid.es/nightly/release/26.10.x-production-de-de/');
    expect(appRoute('/nightly/release/26.10.x-production-de-de/details/movie/MOV1')).toBe('https://deploy.mca.tid.es/nightly/release/26.10.x-production-de-de/details/movie/MOV1');
    (env as { appUrl: string }).appUrl = 'https://tv.o2online.de/';
    expect(appRoute('/tv-guide/now')).toBe('https://tv.o2online.de/tv-guide/now');
  } finally {
    (env as { appUrl: string }).appUrl = original;
  }
});
