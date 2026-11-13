// Formato dos dados do app e a validação que impõe esse formato.
//
// sanear() recebe dados de origem não confiável (localStorage, e no futuro um
// arquivo de backup) e devolve um estado que obedece ao formato abaixo, sem
// exceção: o resto do app pode usar os campos sem conferir tipo.
//
// estado = {
//   versao:       número (sempre a versão atual)
//   aba:          'rotinas' | 'habitos' | 'tarefas'
//   rotinas:      [{ id, nome, itens: [{ id, tipo: 'secao' | 'item', texto, hora: 'HH:MM' | null,
//                    habitoId: id de um hábito existente | null (marcar o item marca o hábito) }] }]
//   rotinaAtiva:  id de uma rotina existente | null
//   marcasRotina: { data: 'AAAA-MM-DD', porRotina: { rotinaId: [itemId] } }   (só o dia corrente;
//                 os ids ficam na ordem em que os itens foram marcados)
//   marcadosNoFim: verdadeiro mostra os itens marcados no fim da seção deles (padrão: verdadeiro)
//   habitos:      [{ id, nome, cor, tipo: 'simnao' | 'numero', unidade: texto | null, meta: número | null,
//                    arquivado }]
//   registros:    { habitoId: { 'AAAA-MM-DD': 'feito' | 'pulado' | número >= 0 } }
//   ocultarConcluidos: verdadeiro esconde da grade os hábitos já resolvidos hoje (padrão: falso)
//   ocultarArquivados: verdadeiro esconde da grade os hábitos arquivados (padrão: verdadeiro)
//   listas:       [{ id, nome }]   (sempre pelo menos uma)
//   listaAtiva:   id de uma lista existente | 'estrela'
//   tarefas:      [{ id, listaId, titulo, notas, prazo: 'AAAA-MM-DD' | null,
//                    hora: 'HH:MM' | null (só existe com prazo),
//                    repeticao: { cada, unidade } | null (só existe com prazo; ver repeticao.js),
//                    estrela, feita, criadaEm, feitaEm: número | null }]
//   ordemTarefas: 'data' | 'estrela' | 'titulo' | 'criacao'   (padrão: 'data')
// }
//
// Regra de correção: o que dá para aproveitar é corrigido (texto cortado no
// limite, cor desconhecida vira a padrão, tarefa de lista inexistente vai para
// a primeira lista); o que não dá é descartado. Cada correção gera um aviso.

import { dataValida, horaValida } from './datas.js';
import { COR_PADRAO, corValida } from './paleta.js';
import { VERSAO } from './migracao.js';
import { repeticaoValida } from './repeticao.js';

// Limites de tamanho: fonte única para a validação e para os campos da interface.
export const LIMITES = Object.freeze({
  id: 64,
  nomeRotina: 60,
  textoItem: 300,
  itensPorRotina: 500,
  nomeHabito: 60,
  unidade: 12,
  nomeLista: 40,
  tituloTarefa: 200,
  notasTarefa: 2000,
});

export const ABAS = Object.freeze(['rotinas', 'habitos', 'tarefas']);
export const VISAO_ESTRELA = 'estrela'; // valor de listaAtiva para a visão "com estrela"
export const NOME_LISTA_PADRAO = 'Minhas tarefas';
// Ordens da lista de tarefas; a primeira é a padrão. A ordenação em si está em prazos.js.
export const ORDENS_TAREFAS = Object.freeze(['data', 'estrela', 'titulo', 'criacao']);

export const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const idValido = (v) => typeof v === 'string' && v.length > 0 && v.length <= LIMITES.id;
const numeroValido = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const cortar = (v, limite) => (typeof v === 'string' ? v.trim().slice(0, limite).trim() : '');

// Mantém só objetos com id válido e ainda não visto; o resto vira aviso.
function comIdUnico(valor, nome, avisos) {
  if (!Array.isArray(valor)) {
    if (valor !== undefined) avisos.push(`${nome}: esperava uma lista, veio ${typeof valor}`);
    return [];
  }
  const vistos = new Set();
  return valor.filter((entrada) => {
    const ok = ehObjeto(entrada) && idValido(entrada.id) && !vistos.has(entrada.id);
    if (ok) vistos.add(entrada.id);
    else avisos.push(`${nome}: entrada sem id válido ou repetida, descartada`);
    return ok;
  });
}

// Ligação com hábito que não existe mais vira null sem aviso: é o que sobra quando o hábito é excluído.
function sanearItem(item, idsDeHabitos, avisos) {
  const texto = cortar(item.texto, LIMITES.textoItem);
  if (!texto) {
    avisos.push('item de rotina sem texto, descartado');
    return [];
  }
  if (item.tipo === 'secao') return [{ id: item.id, tipo: 'secao', texto, hora: null, habitoId: null }];
  if (item.tipo !== 'item') avisos.push('item de rotina com tipo desconhecido, tratado como item');
  return [
    {
      id: item.id,
      tipo: 'item',
      texto,
      hora: horaValida(item.hora) ? item.hora : null,
      habitoId: idsDeHabitos.has(item.habitoId) ? item.habitoId : null,
    },
  ];
}

function sanearRotinas(valor, idsDeHabitos, avisos) {
  return comIdUnico(valor, 'rotinas', avisos).map((rotina) => ({
    id: rotina.id,
    nome: cortar(rotina.nome, LIMITES.nomeRotina) || 'Rotina',
    itens: comIdUnico(rotina.itens, 'itens de rotina', avisos)
      .slice(0, LIMITES.itensPorRotina)
      .flatMap((item) => sanearItem(item, idsDeHabitos, avisos)),
  }));
}

function sanearHabitos(valor, avisos) {
  return comIdUnico(valor, 'hábitos', avisos).map((habito) => {
    const numerico = habito.tipo === 'numero';
    if (!corValida(habito.cor)) avisos.push('hábito com cor desconhecida, trocada pela padrão');
    return {
      id: habito.id,
      nome: cortar(habito.nome, LIMITES.nomeHabito) || 'Hábito',
      cor: corValida(habito.cor) ? habito.cor : COR_PADRAO,
      tipo: numerico ? 'numero' : 'simnao',
      unidade: numerico ? cortar(habito.unidade, LIMITES.unidade) || null : null,
      meta: numerico ? (numeroValido(habito.meta) && habito.meta > 0 ? habito.meta : 1) : null,
      arquivado: habito.arquivado === true,
    };
  });
}

const marcaValida = (v) => v === 'feito' || v === 'pulado' || numeroValido(v);

// Só registros de hábitos existentes, com data real e valor reconhecido.
function sanearRegistros(valor, habitos, avisos) {
  const origem = ehObjeto(valor) ? valor : {};
  const registros = {};
  for (const { id } of habitos) {
    if (!ehObjeto(origem[id])) continue;
    const entradas = Object.entries(origem[id]);
    const validas = entradas.filter(([dia, marca]) => dataValida(dia) && marcaValida(marca));
    if (validas.length !== entradas.length) avisos.push('registro de hábito inválido, descartado');
    if (validas.length) registros[id] = Object.fromEntries(validas);
  }
  return registros;
}

function sanearListas(valor, gerarId, avisos) {
  const listas = comIdUnico(valor, 'listas', avisos).map((lista) => ({
    id: lista.id,
    nome: cortar(lista.nome, LIMITES.nomeLista) || 'Lista',
  }));
  // O app sempre tem pelo menos uma lista.
  return listas.length ? listas : [{ id: gerarId(), nome: NOME_LISTA_PADRAO }];
}

function sanearTarefas(valor, listas, avisos) {
  const idsDeLista = new Set(listas.map((l) => l.id));
  return comIdUnico(valor, 'tarefas', avisos).map((tarefa) => {
    if (!idsDeLista.has(tarefa.listaId)) avisos.push('tarefa de lista inexistente, movida para a primeira');
    const feita = tarefa.feita === true;
    const criadaEm = numeroValido(tarefa.criadaEm) ? tarefa.criadaEm : 0;
    const prazo = dataValida(tarefa.prazo) ? tarefa.prazo : null;
    return {
      id: tarefa.id,
      listaId: idsDeLista.has(tarefa.listaId) ? tarefa.listaId : listas[0].id,
      titulo: cortar(tarefa.titulo, LIMITES.tituloTarefa) || 'Sem título',
      notas: cortar(tarefa.notas, LIMITES.notasTarefa),
      prazo,
      hora: prazo && horaValida(tarefa.hora) ? tarefa.hora : null, // horário sem data não existe
      repeticao:
        prazo && repeticaoValida(tarefa.repeticao)
          ? { cada: tarefa.repeticao.cada, unidade: tarefa.repeticao.unidade }
          : null,
      estrela: tarefa.estrela === true,
      feita,
      criadaEm,
      feitaEm: feita ? (numeroValido(tarefa.feitaEm) ? tarefa.feitaEm : criadaEm) : null,
    };
  });
}

// As marcas valem só para o dia corrente e só para itens (não seções) que existem.
function sanearMarcas(valor, rotinas, dia) {
  const porRotina = {};
  if (ehObjeto(valor) && valor.data === dia && ehObjeto(valor.porRotina)) {
    for (const rotina of rotinas) {
      const marcaveis = new Set(rotina.itens.filter((i) => i.tipo === 'item').map((i) => i.id));
      const marcas = valor.porRotina[rotina.id];
      if (!Array.isArray(marcas)) continue;
      const validas = [...new Set(marcas.filter((id) => marcaveis.has(id)))];
      if (validas.length) porRotina[rotina.id] = validas;
    }
  }
  return { data: dia, porRotina };
}

// dados:    objeto já migrado para a versão atual (ver migracao.js)
// dia:      data de hoje, 'AAAA-MM-DD'
// gerarId:  função que devolve um id novo (usada se faltar a lista padrão)
// Devolve { estado, avisos }: o estado no formato do topo deste arquivo e a
// lista de correções feitas (vazia quando os dados já estavam certos).
export function sanear(dados, { dia, gerarId }) {
  const avisos = [];
  // Os hábitos vêm primeiro: os itens de rotina podem apontar para eles.
  const habitos = sanearHabitos(dados.habitos, avisos);
  const rotinas = sanearRotinas(dados.rotinas, new Set(habitos.map((x) => x.id)), avisos);
  const listas = sanearListas(dados.listas, gerarId, avisos);

  const estado = {
    versao: VERSAO,
    aba: ABAS.includes(dados.aba) ? dados.aba : ABAS[0],
    rotinas,
    rotinaAtiva: rotinas.some((r) => r.id === dados.rotinaAtiva)
      ? dados.rotinaAtiva
      : (rotinas[0]?.id ?? null),
    marcasRotina: sanearMarcas(dados.marcasRotina, rotinas, dia),
    marcadosNoFim: dados.marcadosNoFim !== false,
    habitos,
    registros: sanearRegistros(dados.registros, habitos, avisos),
    ocultarConcluidos: dados.ocultarConcluidos === true,
    ocultarArquivados: dados.ocultarArquivados !== false,
    listas,
    listaAtiva:
      dados.listaAtiva === VISAO_ESTRELA || listas.some((l) => l.id === dados.listaAtiva)
        ? dados.listaAtiva
        : listas[0].id,
    tarefas: sanearTarefas(dados.tarefas, listas, avisos),
    ordemTarefas: ORDENS_TAREFAS.includes(dados.ordemTarefas) ? dados.ordemTarefas : ORDENS_TAREFAS[0],
  };
  return { estado, avisos };
}
