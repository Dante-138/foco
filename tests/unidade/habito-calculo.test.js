import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JANELA_ANEL,
  cumprido,
  formatar,
  lerNumero,
  metaDe,
  proximaMarca,
  resolvido,
  taxa,
  visiveis,
} from '../../www/js/nucleo/habito-calculo.js';

const simNao = { tipo: 'simnao' };
const copos = { tipo: 'numero', meta: 2, unidade: 'copos' };
const HOJE = '2026-11-12';

test('lerNumero aceita vírgula ou ponto como decimal', () => {
  assert.equal(lerNumero('1,5'), 1.5);
  assert.equal(lerNumero('1.5'), 1.5);
  assert.equal(lerNumero('1.50'), 1.5);
  assert.equal(lerNumero('0.500'), 0.5);
  assert.equal(lerNumero('0,25'), 0.25);
  assert.equal(lerNumero(' 2 '), 2);
  assert.equal(lerNumero('0'), 0);
  assert.equal(lerNumero('1500'), 1500);
  assert.equal(lerNumero(3), 3);
});

test('lerNumero trata ponto seguido de três dígitos como milhar', () => {
  assert.equal(lerNumero('1.500'), 1500);
  assert.equal(lerNumero('10.000'), 10000);
  assert.equal(lerNumero('1.234.567'), 1234567);
  assert.equal(lerNumero('1.500,5'), 1500.5);
  assert.equal(lerNumero('10.000,25'), 10000.25);
});

test('lerNumero recusa o que não é número puro', () => {
  const ruins = [
    'abc',
    '',
    '   ',
    '-1',
    '2abc',
    '3 copos',
    '1e3',
    '1,5,3',
    '1.5.3',
    '1,',
    ',5',
    '.5',
    '1.500.25',
  ];
  for (const ruim of ruins) assert.equal(lerNumero(ruim), null, ruim);
  assert.equal(lerNumero('Infinity'), null);
  assert.equal(lerNumero(null), null);
  assert.equal(lerNumero(undefined), null);
});

test('lerNumero recusa número grande demais para ser representado', () => {
  assert.equal(lerNumero('9'.repeat(400)), null);
});

test('a janela do anel é de uma semana', () => {
  assert.equal(JANELA_ANEL, 7);
});

test('formatar usa vírgula decimal', () => {
  assert.equal(formatar(1.5), '1,5');
  assert.equal(formatar(2), '2');
});

test('meta padrão de hábito numérico é 1', () => {
  assert.equal(metaDe({ tipo: 'numero', meta: null }), 1);
  assert.equal(metaDe(copos), 2);
});

test('cumprido em hábito de sim ou não só vale para "feito"', () => {
  assert.equal(cumprido(simNao, 'feito'), true);
  assert.equal(cumprido(simNao, 'pulado'), false);
  assert.equal(cumprido(simNao, undefined), false);
  assert.equal(cumprido(simNao, 3), false);
});

test('cumprido em hábito numérico exige atingir a meta', () => {
  assert.equal(cumprido(copos, 2), true);
  assert.equal(cumprido(copos, 2.5), true);
  assert.equal(cumprido(copos, 1.5), false);
  assert.equal(cumprido(copos, 'feito'), false);
  assert.equal(cumprido(copos, undefined), false);
});

test('proximaMarca alterna vazio -> feito -> pulado -> vazio', () => {
  assert.equal(proximaMarca(undefined), 'feito');
  assert.equal(proximaMarca('feito'), 'pulado');
  assert.equal(proximaMarca('pulado'), null);
});

test('taxa sem registro é zero', () => {
  assert.equal(taxa(simNao, {}, HOJE), 0);
});

test('taxa conta só os últimos 7 dias até hoje', () => {
  const registro = {
    '2026-11-12': 'feito',
    '2026-11-11': 'feito',
    '2026-11-06': 'feito', // sétimo dia da janela
    '2026-11-05': 'feito', // fora da janela
  };
  assert.equal(taxa(simNao, registro, HOJE), 3 / 7);
});

test('taxa ignora os dias pulados no denominador', () => {
  const registro = { '2026-11-12': 'feito', '2026-11-11': 'pulado', '2026-11-10': 'pulado' };
  assert.equal(taxa(simNao, registro, HOJE), 1 / 5);
});

test('taxa com todos os dias pulados é zero, sem dividir por zero', () => {
  const registro = {};
  for (let d = 6; d <= 12; d += 1) registro[`2026-11-${String(d).padStart(2, '0')}`] = 'pulado';
  assert.equal(taxa(simNao, registro, HOJE), 0);
});

test('taxa de hábito numérico conta os dias em que a meta foi atingida', () => {
  const registro = { '2026-11-12': 2, '2026-11-11': 1.5, '2026-11-10': 3 };
  assert.equal(taxa(copos, registro, HOJE), 2 / 7);
});

test('resolvido: cumprido ou pulado; vazio e numérico abaixo da meta ainda pedem ação', () => {
  assert.equal(resolvido(simNao, 'feito'), true);
  assert.equal(resolvido(simNao, 'pulado'), true);
  assert.equal(resolvido(simNao, undefined), false);
  assert.equal(resolvido(copos, 2), true);
  assert.equal(resolvido(copos, 1), false);
  assert.equal(resolvido(copos, 'pulado'), true);
});

test('visiveis: sem filtro mostra todos, na ordem em que estão', () => {
  const habitos = [
    { id: 'a', tipo: 'simnao', arquivado: false },
    { id: 'b', tipo: 'simnao', arquivado: true },
  ];
  const vistos = visiveis(habitos, { a: { [HOJE]: 'feito' } }, HOJE, {
    ocultarConcluidos: false,
    ocultarArquivados: false,
  });
  assert.deepEqual(vistos, habitos);
});

test('visiveis: ocultar arquivados tira só os arquivados', () => {
  const habitos = [
    { id: 'a', tipo: 'simnao', arquivado: false },
    { id: 'b', tipo: 'simnao', arquivado: true },
  ];
  const vistos = visiveis(habitos, {}, HOJE, { ocultarConcluidos: false, ocultarArquivados: true });
  assert.deepEqual(
    vistos.map((h) => h.id),
    ['a'],
  );
});

test('visiveis: ocultar concluídos olha só o dia de hoje e poupa o hábito recém-marcado', () => {
  const habitos = [
    { id: 'feito', tipo: 'simnao', arquivado: false },
    { id: 'pulado', tipo: 'simnao', arquivado: false },
    { id: 'ontem', tipo: 'simnao', arquivado: false },
    { id: 'parcial', tipo: 'numero', meta: 2, arquivado: false },
    { id: 'vazio', tipo: 'simnao', arquivado: false },
  ];
  const registros = {
    feito: { [HOJE]: 'feito' },
    pulado: { [HOJE]: 'pulado' },
    ontem: { '2026-11-11': 'feito' },
    parcial: { [HOJE]: 1 },
  };
  const filtros = { ocultarConcluidos: true, ocultarArquivados: true };

  assert.deepEqual(
    visiveis(habitos, registros, HOJE, filtros).map((h) => h.id),
    ['ontem', 'parcial', 'vazio'],
  );
  assert.deepEqual(
    visiveis(habitos, registros, HOJE, { ...filtros, manter: 'feito' }).map((h) => h.id),
    ['feito', 'ontem', 'parcial', 'vazio'],
  );
});
