import { expect, test } from '@playwright/test';
import { requestShape } from '../../src/catalog/endpoint-id';

test('requestShape reduces PIDs to their kind and blanks query values', () => {
  expect(requestShape('GET nsh/unified-detailed/MOV123456?lang=de')).toBe('GET nsh/unified-detailed/MOV?lang=');
});

test('requestShape distingue tipos de contenido y agrupa el mismo tipo', () => {
  const shape = (pid: string) => requestShape(`GET nsh/unified-detailed/${pid}`);
  // Película y serie → shapes distintas; dos películas → la misma (un solo sample por tipo).
  expect(shape('MOV1001')).toBe(shape('MOV1002'));
  expect(shape('SER2001')).not.toBe(shape('MOV1001'));
  expect(new Set(['MOV1001', 'SER2001', 'LSC3001', 'LSR4001', 'REC5001'].map(shape)).size).toBe(5);
});
