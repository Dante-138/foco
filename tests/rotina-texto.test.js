import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoParaItens, itensParaTexto } from '../www/js/rotina-texto.js';

// Gerador de ids previsível: n1, n2, n3...
function contador() {
  let n = 0;
  return () => `n${(n += 1)}`;
}

const ler = (texto, antigos = []) => textoParaItens(texto, antigos, contador());
const semId = (itens) => itens.map(({ tipo, texto, hora }) => ({ tipo, texto, hora }));

test('linhas viram itens, "#" abre seção e linhas em branco são ignoradas', () => {
  const itens = ler('# MANHÃ\n\nAcordar\n   \nArrumar a cama');
  assert.deepEqual(semId(itens), [
    { tipo: 'secao', texto: 'MANHÃ', hora: null },
    { tipo: 'item', texto: 'Acordar', hora: null },
    { tipo: 'item', texto: 'Arrumar a cama', hora: null },
  ]);
});

test('horário no começo da linha vira o campo hora, com zero à esquerda', () => {
  assert.deepEqual(semId(ler('22:30 Chegar em casa\n9:05 Bater o ponto')), [
    { tipo: 'item', texto: 'Chegar em casa', hora: '22:30' },
    { tipo: 'item', texto: 'Bater o ponto', hora: '09:05' },
  ]);
});

test('hífen entre o horário e o texto é descartado', () => {
  assert.deepEqual(semId(ler('22:31 - Guardar a chave')), [
    { tipo: 'item', texto: 'Guardar a chave', hora: '22:31' },
  ]);
});

test('horário impossível fica como texto comum', () => {
  assert.deepEqual(semId(ler('25:00 Dormir\n10:75 Almoçar')), [
    { tipo: 'item', texto: '25:00 Dormir', hora: null },
    { tipo: 'item', texto: '10:75 Almoçar', hora: null },
  ]);
});

test('horário sem texto depois não vira item vazio', () => {
  assert.deepEqual(semId(ler('22:30')), [{ tipo: 'item', texto: '22:30', hora: null }]);
});

test('marcadores de checklist colado de outro app são removidos', () => {
  const itens = ler('[ ] Leitura\n[x] 22:00 Sair\n- Banho\n• Jantar\n☐ Dormir');
  assert.deepEqual(
    itens.map((i) => [i.hora, i.texto]),
    [
      [null, 'Leitura'],
      ['22:00', 'Sair'],
      [null, 'Banho'],
      [null, 'Jantar'],
      [null, 'Dormir'],
    ],
  );
});

test('quebra de linha do Windows (CRLF) é aceita', () => {
  assert.equal(ler('Um\r\nDois\r\n').length, 2);
});

test('"#" sozinho não cria seção sem nome', () => {
  assert.deepEqual(
    ler('#\n##   \nItem').map((i) => i.texto),
    ['Item'],
  );
});

test('editar preserva o id de quem manteve o texto, mesmo mudando o horário', () => {
  const antes = ler('# NOITE\n22:00 Sair\n22:30 Chegar');
  const depois = textoParaItens('# NOITE\n22:05 Sair\nItem novo\n22:30 Chegar', antes, () => 'novo');
  assert.deepEqual(
    depois.map((i) => i.id),
    [antes[0].id, antes[1].id, 'novo', antes[2].id],
  );
  assert.equal(depois[1].hora, '22:05');
});

test('itens com o mesmo texto recebem ids diferentes e são reaproveitados em ordem', () => {
  const antes = ler('Escovar os dentes\nAlmoço\nEscovar os dentes');
  assert.notEqual(antes[0].id, antes[2].id);

  const depois = textoParaItens(
    'Escovar os dentes\nEscovar os dentes\nEscovar os dentes',
    antes,
    () => 'novo',
  );
  assert.deepEqual(
    depois.map((i) => i.id),
    [antes[0].id, antes[2].id, 'novo'],
  );
});

test('itensParaTexto separa as seções com linha em branco', () => {
  const texto = '# MANHÃ\n06:30 Acordar\nArrumar a cama\n\n# TRABALHO\n09:00 Bater o ponto';
  assert.equal(itensParaTexto(ler(texto)), texto);
});

test('texto -> itens -> texto -> itens mantém o conteúdo', () => {
  const itens = ler('[ ] 7:00 Café\n# TARDE\n- Estudar');
  assert.deepEqual(semId(ler(itensParaTexto(itens))), semId(itens));
});
