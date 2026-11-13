import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cumprido,
  formatar,
  lerNumero,
  metaDe,
  pontuacao,
  proximaMarca,
  resolvido,
  sequencias,
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

// ------------------------------------------------- pontuação e sequências

const PESO = 0.5 ** (1 / 13);
const perto = (obtido, esperado) => assert.ok(Math.abs(obtido - esperado) < 1e-9, `${obtido} != ${esperado}`);

test('pontuação sem registro é zero', () => {
  assert.equal(pontuacao(simNao, {}, HOJE), 0);
});

test('pontuação de hábito feito todo dia sobe como no Loop: perto de 80% em um mês', () => {
  const registro = {};
  for (let dia = 1; dia <= 30; dia += 1) registro[`2026-10-${String(dia).padStart(2, '0')}`] = 'feito';
  perto(pontuacao(simNao, registro, '2026-10-30'), 1 - PESO ** 30);
  assert.ok(pontuacao(simNao, registro, '2026-10-30') > 0.79);
});

test('pontuação: dia em branco conta como não feito, no meio e depois do último registro', () => {
  // feito no dia 9, em branco em 10 e 11, feito em 12
  const comBuraco = { '2026-11-09': 'feito', '2026-11-12': 'feito' };
  const depoisDoPrimeiro = 1 - PESO;
  perto(pontuacao(simNao, comBuraco, HOJE), depoisDoPrimeiro * PESO ** 2 * PESO + (1 - PESO));

  // só o dia 9 registrado; 10 e 11 em branco contam, hoje (12) ainda não
  perto(pontuacao(simNao, { '2026-11-09': 'feito' }, HOJE), depoisDoPrimeiro * PESO ** 2);
  // registrado ontem: nenhum dia em branco a descontar
  perto(pontuacao(simNao, { '2026-11-11': 'feito' }, HOJE), depoisDoPrimeiro);
});

test('pontuação: dia pulado não mexe e registro futuro não entra', () => {
  const comPulado = { '2026-11-10': 'feito', '2026-11-11': 'pulado', '2026-11-12': 'feito' };
  perto(pontuacao(simNao, comPulado, HOJE), (1 - PESO) * PESO + (1 - PESO));
  perto(pontuacao(simNao, { '2026-11-12': 'feito', '2026-11-20': 'feito' }, HOJE), 1 - PESO);
});

test('pontuação do numérico conta a parte da meta feita, sem passar de 100% no dia', () => {
  perto(pontuacao(copos, { '2026-11-12': 1 }, HOJE), 0.5 * (1 - PESO));
  perto(pontuacao(copos, { '2026-11-12': 9 }, HOJE), 1 - PESO);
  assert.equal(pontuacao(copos, { '2026-11-12': 'feito' }, HOJE), 0); // marca que não é número
});

test('sequências: conta dias seguidos, guarda a melhor e zera com um dia em branco', () => {
  const registro = {
    '2026-11-01': 'feito',
    '2026-11-02': 'feito',
    '2026-11-03': 'feito',
    // dia 4 em branco
    '2026-11-11': 'feito',
    '2026-11-12': 'feito',
  };
  assert.deepEqual(sequencias(simNao, registro, HOJE), { atual: 2, melhor: 3 });
  assert.deepEqual(sequencias(simNao, {}, HOJE), { atual: 0, melhor: 0 });
});

test('sequência atual vale até ontem, mas morre se ontem ficou em branco', () => {
  assert.deepEqual(sequencias(simNao, { '2026-11-10': 'feito', '2026-11-11': 'feito' }, HOJE), {
    atual: 2,
    melhor: 2,
  });
  assert.deepEqual(sequencias(simNao, { '2026-11-09': 'feito', '2026-11-10': 'feito' }, HOJE), {
    atual: 0,
    melhor: 2,
  });
});

test('sequências: dia pulado não quebra nem conta; pulado solto não começa sequência', () => {
  const comPulado = {
    '2026-11-09': 'feito',
    '2026-11-10': 'pulado',
    '2026-11-11': 'feito',
    '2026-11-12': 'feito',
  };
  assert.deepEqual(sequencias(simNao, comPulado, HOJE), { atual: 3, melhor: 3 });
  assert.deepEqual(sequencias(simNao, { '2026-11-12': 'pulado' }, HOJE), { atual: 0, melhor: 0 });
});

test('sequências do numérico: dia abaixo da meta quebra', () => {
  const registro = { '2026-11-09': 2, '2026-11-10': 3, '2026-11-11': 1, '2026-11-12': 2 };
  assert.deepEqual(sequencias(copos, registro, HOJE), { atual: 1, melhor: 2 });
});

test('pontuação de sim ou não: marca que não é "feito" nem "pulado" conta como não feito', () => {
  assert.equal(pontuacao(simNao, { '2026-11-12': 3 }, HOJE), 0);
});
