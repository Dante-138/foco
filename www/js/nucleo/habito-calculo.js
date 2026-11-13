// Regras dos hábitos, sem interface: valores, metas e taxa de cumprimento.
// O registro de um hábito é { 'AAAA-MM-DD': 'feito' | 'pulado' | número }.

import { somaDias } from './datas.js';

export const JANELA_ANEL = 7; // dias considerados no anel de progresso

export const formatar = (n) => String(n).replace('.', ',');

const COM_MILHAR = /^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/; // 1.500 ou 10.000,5
const SIMPLES = /^\d+([.,]\d+)?$/; // 1500, 1,5 ou 1.5

// Lê um número digitado, no costume brasileiro:
// - vírgula é sempre decimal ("1,5");
// - ponto seguido de exatamente três dígitos é milhar ("1.500" = 1500, "10.000,5" = 10000,5);
// - qualquer outro ponto é decimal ("1.5" = 1,5; "0.500" = 0,5).
// Devolve null para o que não for número puro: vazio, negativo, "2abc", "1e3".
export function lerNumero(texto) {
  const t = String(texto).trim();
  let n;
  if (COM_MILHAR.test(t)) n = Number(t.replaceAll('.', '').replace(',', '.'));
  else if (SIMPLES.test(t)) n = Number(t.replace(',', '.'));
  else return null;
  return Number.isFinite(n) ? n : null;
}

export const metaDe = (habito) => habito.meta ?? 1;

export function cumprido(habito, valor) {
  if (habito.tipo === 'numero') return typeof valor === 'number' && valor >= metaDe(habito);
  return valor === 'feito';
}

// O hábito não pede mais nada no dia: foi cumprido ou o dia foi pulado.
export const resolvido = (habito, valor) => valor === 'pulado' || cumprido(habito, valor);

// Quais hábitos aparecem na grade, conforme os filtros. "manter" é o id de um hábito
// que continua na tela mesmo resolvido: o que acabou de ser marcado, enquanto a
// resposta ao toque ainda está sendo mostrada.
export function visiveis(habitos, registros, dia, { ocultarConcluidos, ocultarArquivados, manter = null }) {
  return habitos.filter((habito) => {
    if (ocultarArquivados && habito.arquivado) return false;
    if (!ocultarConcluidos || habito.id === manter) return true;
    return !resolvido(habito, registros[habito.id]?.[dia]);
  });
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
