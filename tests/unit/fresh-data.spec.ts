import { expect, test } from '@playwright/test';
import { homeCardPids } from '../../src/testing/fresh-data';

test('homeCardPids takes card and wrapped-content ids, in order, without duplicates or noise', () => {
  const home = {
    home: [
      { type: 'carousel', image: 'IMG12345', contents: [{ pid: 'EDI1001', content: { pid: 'MOV2002' } }, { pid: 'SER3003' }] },
      { type: 'live', channel: 'CHA9999', contents: [{ pid: 'MOV2002' }, { pid: 42 }, { pid: 'not-a-pid' }] },
      { type: 'empty' },
      null,
    ],
  };
  expect(homeCardPids(home)).toEqual(['EDI1001', 'MOV2002', 'SER3003']);
});

test('homeCardPids tolerates bodies without a home list', () => {
  expect(homeCardPids(null)).toEqual([]);
  expect(homeCardPids({ home: 'x' })).toEqual([]);
});
