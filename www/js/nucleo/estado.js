// Leitura do estado salvo: texto bruto -> JSON -> migração -> validação.
// Sem acesso a armazenamento: quem lê e grava o texto é store.js.

import { VERSAO, migrar } from './migracao.js';
import { ABAS, NOME_LISTA_PADRAO, ORDENS_TAREFAS, ehObjeto, sanear } from './esquema.js';

export const PROBLEMA = Object.freeze({
  ILEGIVEL: 'ilegivel', // o texto salvo não é JSON de um objeto
  VERSAO_MAIS_NOVA: 'versao-mais-nova', // gravado por uma versão futura do app
});

export function estadoInicial({ dia, gerarId }) {
  const lista = { id: gerarId(), nome: NOME_LISTA_PADRAO };
  return {
    versao: VERSAO,
    aba: ABAS[0],
    rotinas: [],
    rotinaAtiva: null,
    marcasRotina: { data: dia, porRotina: {} },
    marcadosNoFim: true,
    habitos: [],
    registros: {},
    notasHabito: {},
    ocultarConcluidos: false,
    ocultarArquivados: true,
    listas: [lista],
    listaAtiva: lista.id,
    tarefas: [],
    ordemTarefas: ORDENS_TAREFAS[0],
    lembretes: true,
  };
}

function analisar(bruto) {
  try {
    const dados = JSON.parse(bruto);
    return ehObjeto(dados) ? dados : null;
  } catch {
    return null;
  }
}

// bruto:    texto lido do armazenamento (null ou vazio quando não há nada salvo)
// contexto: { dia: 'AAAA-MM-DD', gerarId: função }
// Devolve { estado, problema, avisos }:
// - problema null: estado pronto para uso; avisos lista o que a validação corrigiu.
// - PROBLEMA.ILEGIVEL: devolve o estado inicial; quem chama deve guardar o texto bruto.
// - PROBLEMA.VERSAO_MAIS_NOVA: devolve o estado inicial e quem chama não deve gravar
//   nada, para não sobrescrever dados que este código não entende.
export function lerEstado(bruto, contexto) {
  const vazio = (problema) => ({ estado: estadoInicial(contexto), problema, avisos: [] });

  if (bruto == null || bruto === '') return vazio(null);

  const dados = analisar(bruto);
  if (!dados) return vazio(PROBLEMA.ILEGIVEL);

  // Sem número de versão utilizável, trata como a mais antiga: as migrações
  // ignoram o que não reconhecem e a validação corrige o resto.
  const versao = Number.isInteger(dados.versao) && dados.versao >= 1 ? dados.versao : 1;
  if (versao > VERSAO) return vazio(PROBLEMA.VERSAO_MAIS_NOVA);

  const { estado, avisos } = sanear(migrar({ ...dados, versao }), contexto);
  return { estado, problema: null, avisos };
}
