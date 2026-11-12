// Estado do app e persistência.
// Único módulo de dados que toca o armazenamento: quando a casca Android
// entrar, a troca de localStorage por arquivo ou SQLite acontece só aqui.
// Toda leitura passa pela migração e pela validação (nucleo/estado.js), então
// o resto do app recebe sempre um estado no formato descrito em nucleo/esquema.js.

import { uid } from './nucleo/ids.js';
import { hoje } from './nucleo/datas.js';
import { PROBLEMA, lerEstado } from './nucleo/estado.js';

export const CHAVE = 'foco:v1';

// Guarda o último conteúdo salvo que estava ilegível ou precisou de correção,
// antes que o próximo salvar() grave por cima.
const CHAVE_COPIA = `${CHAVE}:copia`;

function carregar() {
  let bruto = null;
  try {
    bruto = localStorage.getItem(CHAVE);
  } catch (erro) {
    console.error('Armazenamento indisponível', erro);
  }

  const leitura = lerEstado(bruto, { dia: hoje(), gerarId: uid });

  if (leitura.problema === PROBLEMA.ILEGIVEL || leitura.avisos.length) {
    console.warn('Dados salvos com problema:', leitura.problema ?? leitura.avisos);
    try {
      localStorage.setItem(CHAVE_COPIA, bruto);
    } catch {
      /* sem espaço para a cópia: segue sem ela */
    }
  }
  return leitura;
}

const leitura = carregar();

export const estado = leitura.estado;

// null quando a leitura deu certo; senão, um valor de PROBLEMA (nucleo/estado.js).
export const problemaDeCarga = leitura.problema;

// Quantas correções a validação precisou fazer nos dados salvos.
export const correcoesNaCarga = leitura.avisos.length;

export function salvar() {
  // Dados gravados por uma versão mais nova do app nunca são sobrescritos.
  if (problemaDeCarga === PROBLEMA.VERSAO_MAIS_NOVA) return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (erro) {
    console.error('Falha ao salvar', erro);
    window.dispatchEvent(new CustomEvent('foco:falha-ao-salvar'));
  }
}

// As marcas das rotinas valem só para o dia corrente: virou o dia, zera.
export function marcasDeHoje() {
  if (estado.marcasRotina.data !== hoje()) {
    estado.marcasRotina = { data: hoje(), porRotina: {} };
  }
  return estado.marcasRotina.porRotina;
}
