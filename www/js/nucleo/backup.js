// Backup dos dados em texto: o próprio estado do app, em JSON.
// Aqui fica só a regra. Área de transferência e armazenamento são da interface.

import { PROBLEMA, lerEstado } from './estado.js';
import { ehObjeto } from './esquema.js';

export const MOTIVO = Object.freeze({
  VAZIO: 'vazio', // nada foi colado
  ILEGIVEL: 'ilegivel', // não é JSON de um objeto
  NAO_E_BACKUP: 'nao-e-backup', // é JSON, mas sem nenhuma coleção do Foco
  VERSAO_MAIS_NOVA: 'versao-mais-nova', // feito por uma versão futura do app
});

const COLECOES = ['rotinas', 'habitos', 'listas', 'tarefas'];

export const gerarBackup = (estado) => JSON.stringify(estado);

// Contagens para mostrar à pessoa o que um estado contém.
export function resumir(estado) {
  return {
    rotinas: estado.rotinas.length,
    habitos: estado.habitos.length,
    registros: Object.values(estado.registros).reduce((n, registro) => n + Object.keys(registro).length, 0),
    listas: estado.listas.length,
    tarefas: estado.tarefas.length,
  };
}

// Confere um texto colado, sem alterar nada. Passa pela mesma migração e
// validação da leitura normal (estado.js).
// contexto: { dia: 'AAAA-MM-DD', gerarId: função }
// Devolve { ok: false, motivo } ou { ok: true, estado, correcoes, resumo }.
export function lerBackup(texto, contexto) {
  const bruto = typeof texto === 'string' ? texto.trim() : '';
  if (!bruto) return { ok: false, motivo: MOTIVO.VAZIO };

  let dados;
  try {
    dados = JSON.parse(bruto);
  } catch {
    return { ok: false, motivo: MOTIVO.ILEGIVEL };
  }
  if (!ehObjeto(dados)) return { ok: false, motivo: MOTIVO.ILEGIVEL };

  // Um JSON qualquer, até "{}", viraria um estado vazio e apagaria tudo ao restaurar.
  if (!COLECOES.some((colecao) => Array.isArray(dados[colecao]))) {
    return { ok: false, motivo: MOTIVO.NAO_E_BACKUP };
  }

  const leitura = lerEstado(bruto, contexto);
  if (leitura.problema === PROBLEMA.VERSAO_MAIS_NOVA) {
    return { ok: false, motivo: MOTIVO.VERSAO_MAIS_NOVA };
  }
  return {
    ok: true,
    estado: leitura.estado,
    correcoes: leitura.avisos.length,
    resumo: resumir(leitura.estado),
  };
}
