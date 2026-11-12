// Regras dos hábitos, sem interface: valores, metas e taxa de cumprimento.
// O registro de um hábito é { 'AAAA-MM-DD': 'feito' | 'pulado' | número }.

import { somaDias } from './datas.js';

export const JANELA_ANEL = 7; // dias considerados no anel de progresso

export const formatar = (n) => String(n).replace('.', ',');

// Aceita vírgula ou ponto. Devolve null para texto inválido ou número negativo.
export function lerNumero(texto) {
  const n = Number.parseFloat(String(texto).trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const metaDe = (habito) => habito.meta ?? 1;

export function cumprido(habito, valor) {
  if (habito.tipo === 'numero') return typeof valor === 'number' && valor >= metaDe(habito);
  return valor === 'feito';
}

// Toque em hábito de sim ou não: vazio -> feito -> pulado -> vazio (null).
export function proximaMarca(atual) {
  if (atual === 'feito') return 'pulado';
  if (atual === 'pulado') return null;
  return 'feito';
}

// Fração de dias cumpridos nos últimos "janela" dias até "dia", ignorando os pulados.
export function taxa(habito, registro, dia, janela = JANELA_ANEL) {
  let feitos = 0;
  let validos = 0;
  for (let i = 0; i < janela; i += 1) {
    const valor = registro[somaDias(dia, -i)];
    if (valor === 'pulado') continue;
    validos += 1;
    if (cumprido(habito, valor)) feitos += 1;
  }
  return validos ? feitos / validos : 0;
}
