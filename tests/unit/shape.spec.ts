import { expect, test } from '@playwright/test';
import { diffShapes, inferFromSamples, validate } from '../../src/contracts/shape';

const sampleA = { home: [{ type: 'editorials', title: 'Top', contents: [{ pid: 'MOV1234', title: 'A', triangles: { isTvod: true } }, { pid: 'MOV5678', title: 'B' }] }] };
const sampleB = { home: [{ type: 'live', title: null, contents: [{ pid: 'EPI1234', title: 'C' }] }] };

test.describe('contract shape', () => {
  const shape = inferFromSamples([sampleA, sampleB])!;

  test('a recorded-like response passes', () => {
    expect(validate(sampleA, shape).filter((v) => v.kind !== 'added')).toEqual([]);
  });

  test('field present only in some elements is optional; always-present field is required', () => {
    const items = shape.properties!.home!.items!.properties!.contents!.items!;
    expect(items.required).toEqual(['pid', 'title']);
    expect(shape.properties!.home!.items!.properties!.title!.types).toEqual(['null', 'string']);
  });

  test('removed field and changed type are breaking, new field is not', () => {
    const broken = { home: [{ type: 'live', title: 'x', contents: [{ pid: 123, extra: 1 }] }] };
    const v = validate(broken, shape);
    expect(v).toContainEqual({ path: '$.home[].contents[].title', kind: 'missing', expected: 'string' });
    expect(v).toContainEqual({ path: '$.home[].contents[].pid', kind: 'type', expected: 'string', actual: 'number' });
    expect(v).toContainEqual({ path: '$.home[].contents[].extra', kind: 'added', actual: 'number' });
  });

  test('overrides make a path optional', () => {
    const v = validate({ home: [{ type: 'x', title: 'y', contents: [{ pid: 'MOV1' }] }] }, shape, ['$.home[].contents[].title']);
    expect(v.filter((x) => x.kind !== 'added')).toEqual([]);
  });

  test('objects keyed by ids collapse into a map', () => {
    const s = inferFromSamples([{ byId: { MOV1111: { t: 'a' }, MOV2222: { t: 'b' }, MOV3333: { t: 'c' } } }])!;
    expect(s.properties!.byId!.mapValues).toBeTruthy();
    expect(validate({ byId: { MOV9999: { t: 'z' } } }, s)).toEqual([]);
  });

  test('diff between versions', () => {
    const next = inferFromSamples([{ home: [{ type: 1, contents: [{ pid: 'MOV1', title: 'x', badge: 'new' }] }] }])!;
    const d = diffShapes(shape, next);
    expect(d.removed).toContain('$.home[].title');
    expect(d.typeChanged).toContainEqual({ path: '$.home[].type', from: 'string', to: 'number' });
    expect(d.added).toContain('$.home[].contents[].badge');
  });
});
