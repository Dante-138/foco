// Estado do app e persistência.
// Tudo que toca o armazenamento fica neste arquivo: quando a casca Android
// entrar, a troca de localStorage por arquivo ou SQLite acontece só aqui.

import { uid } from './ids.js';
import { hoje } from './datas.js';
import { VERSAO, migrar } from './migracao.js';

const CHAVE = 'foco:v1';

// rotinas:      [{ id, nome, itens: [{ id, tipo: 'secao' | 'item', texto, hora }] }]
// marcasRotina: { data: 'AAAA-MM-DD', porRotina: { rotinaId: [itemId] } }  (só o dia corrente)
// habitos:      [{ id, nome, cor (chave da paleta), tipo: 'simnao' | 'numero', unidade, meta }]
// registros:    { habitoId: { 'AAAA-MM-DD': 'feito' | 'pulado' | número } }
// listas:       [{ id, nome }]
// tarefas:      [{ id, listaId, titulo, notas, prazo: 'AAAA-MM-DD' | null,
//                  estrela, feita, criadaEm, feitaEm }]

function estadoInicial() {
  const lista = { id: uid(), nome: 'Minhas tarefas' };
  return {
    versao: VERSAO,
    aba: 'rotinas',
    rotinas: [],
    rotinaAtiva: null,
    marcasRotina: { data: hoje(), porRotina: {} },
    habitos: [],
    registros: {},
    listas: [lista],
    listaAtiva: lista.id,
    tarefas: [],
  };
}

function carregar() {
  let bruto = null;
  try {
    bruto = localStorage.getItem(CHAVE);
    if (bruto) return migrar({ ...estadoInicial(), ...JSON.parse(bruto) });
  } catch (erro) {
    console.error('Falha ao ler os dados salvos', erro);
    // Guarda o conteúdo ilegível antes que o próximo salvar() o sobrescreva.
    try {
      if (bruto) localStorage.setItem(`${CHAVE}:ilegivel`, bruto);
    } catch {
      /* sem espaço para a cópia: segue com o estado inicial */
    }
  }
  return estadoInicial();
}

export const estado = carregar();

export function salvar() {
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
