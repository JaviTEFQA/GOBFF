import { defineContractTest } from '../../../../src/testing/contract-test';

// Contrato de la ficha de serie grabada: GET nsh/unified-detailed/RSR… (árbol de grabaciones, componente Grabaciones).
defineContractTest('GET nsh/unified-detailed/{pid}', { tc: 'MULTISTC-76692', variant: { name: 'RSR', shapes: /unified-detailed\/RSR/ } });
