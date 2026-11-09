import { defineContractTest } from '../../../../src/testing/contract-test';

// Contrato de GET nsh/unified-detailed/{pid} (componente Fichas). Las fichas de serie grabada (RSR…)
// devuelven un árbol de grabaciones con otra forma: tienen su propio contrato en grabaciones/contrato/ficha-serie.
defineContractTest('GET nsh/unified-detailed/{pid}', { tc: 'MULTISTC-76638', excludeShapes: /unified-detailed\/RSR/ });
