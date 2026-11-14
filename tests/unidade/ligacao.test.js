import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registroAposItem, sugerirHabito } from '../../www/js/nucleo/ligacao.js';

const simNao = { tipo: 'simnao' };
const copos = { tipo: 'numero', meta: 2 };

test('sim ou não: marcar o item deixa o hábito feito, inclusive por cima de um dia pulado', () => {
  assert.equal(registroAposItem(simNao, undefined, true, 0), 'feito');
  assert.equal(registroAposItem(simNao, 'pulado', true, 0), 'feito');
  assert.equal(registroAposItem(simNao, 'feito', true, 3), 'feito');
});

test('sim ou não: desmarcar tira o feito só quando nenhum outro item ligado continua marcado', () => {
  assert.equal(registroAposItem(simNao, 'feito', false, 0), null);
  assert.equal(registroAposItem(simNao, 'feito', false, 1), 'feito');
});

test('sim ou não: desmarcar não mexe em dia pulado nem em dia sem registro', () => {
  assert.equal(registroAposItem(simNao, 'pulado', false, 0), 'pulado');
  assert.equal(registroAposItem(simNao, undefined, false, 0), null);
  assert.equal(registroAposItem(simNao, 'pulado', false, 2), 'pulado');
});

test('numérico: cada item marcado soma 1 e cada desmarcado tira 1, sem ficar negativo', () => {
  assert.equal(registroAposItem(copos, undefined, true, 0), 1);
  assert.equal(registroAposItem(copos, 1, true, 0), 2);
  assert.equal(registroAposItem(copos, 2.5, true, 0), 3.5);
  assert.equal(registroAposItem(copos, 2, false, 0), 1);
  assert.equal(registroAposItem(copos, 1, false, 0), null);
  assert.equal(registroAposItem(copos, 0.5, false, 0), null);
});

test('numérico: marcar em dia pulado começa do 1; desmarcar não mexe em dia pulado ou vazio', () => {
  assert.equal(registroAposItem(copos, 'pulado', true, 0), 1);
  assert.equal(registroAposItem(copos, 'pulado', false, 0), 'pulado');
  assert.equal(registroAposItem(copos, undefined, false, 0), null);
});

const HABITOS = [
  { id: 'cama', nome: 'Arrumar a Cama - <8h' },
  { id: 'agua', nome: 'Beber Água - <8h' },
  { id: 'cafe', nome: 'Tomar Café - <8h' },
  { id: 'cafe-puro', nome: 'Café Puro <14h' },
  { id: 'almoco', nome: 'Almoço - 12h' },
  { id: 'almocar', nome: 'Almoçar Marmita - <12h30' },
  { id: 'leitura', nome: 'LEITURA - 1H' },
  { id: 'leitura-matinal', nome: 'Leitura Matinal - <9h' },
  { id: 'velho', nome: 'Meditar', arquivado: true },
];

test('sugere o hábito de mesmo nome, sem ligar para acentos, maiúsculas e espaços', () => {
  assert.equal(sugerirHabito('Arrumar a Cama', HABITOS), 'cama');
  assert.equal(sugerirHabito('  beber   agua ', HABITOS), 'agua');
  assert.equal(sugerirHabito('ALMOÇO', HABITOS), 'almoco');
  assert.equal(sugerirHabito('Almoço - 12h', HABITOS), 'almoco'); // nome idêntico
});

test('não sugere quando o texto é só o começo de outra palavra, ou quando nada combina', () => {
  assert.equal(sugerirHabito('Almoç', HABITOS), null); // "almoc" seguido de letra nos dois
  assert.equal(sugerirHabito('Tomar', HABITOS), 'cafe'); // palavra inteira, um candidato só
  assert.equal(sugerirHabito('Café', HABITOS), 'cafe-puro'); // "Tomar Café" não começa com "café"
  assert.equal(sugerirHabito('Escovar os dentes', HABITOS), null);
  assert.equal(sugerirHabito('', HABITOS), null);
  assert.equal(sugerirHabito('   ', HABITOS), null);
});

test('não sugere quando há mais de um candidato, nem hábito arquivado', () => {
  assert.equal(sugerirHabito('Leitura', HABITOS), null); // "LEITURA - 1H" e "Leitura Matinal"
  assert.equal(sugerirHabito('Meditar', HABITOS), null);
  assert.equal(sugerirHabito('Meditar', [{ id: 'm', nome: 'Meditar' }]), 'm');
});
