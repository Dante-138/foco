// Ordenação e agrupamento das tarefas por prazo.

import { deIso, somaDias } from './datas.js';

const fmtCurta = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtComAno = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });

// "sex., 13 de nov." no ano corrente; com o ano quando for outro.
export function rotuloData(iso, dia) {
  const data = deIso(iso);
  return data.getFullYear() === deIso(dia).getFullYear() ? fmtCurta.format(data) : fmtComAno.format(data);
}

// Ordem: com prazo primeiro (mais próximo no topo), depois as sem data.
export function porPrazo(a, b) {
  if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo) || a.criadaEm - b.criadaEm;
  if (a.prazo) return -1;
  if (b.prazo) return 1;
  return a.criadaEm - b.criadaEm;
}

const alfabetica = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

// Lista única, sem grupos, para as ordens que não são por data (ver ORDENS_TAREFAS
// em esquema.js). Qualquer outro valor cai na ordem por prazo.
//   estrela: as com estrela primeiro; dentro de cada parte, por prazo
//   titulo:  alfabética, sem diferenciar maiúsculas nem acentos
//   criacao: as mais novas primeiro
export function ordenar(pendentes, ordem) {
  const copia = [...pendentes];
  if (ordem === 'estrela')
    return copia.sort((a, b) => Number(b.estrela) - Number(a.estrela) || porPrazo(a, b));
  if (ordem === 'titulo') {
    return copia.sort((a, b) => alfabetica.compare(a.titulo, b.titulo) || a.criadaEm - b.criadaEm);
  }
  if (ordem === 'criacao') return copia.sort((a, b) => b.criadaEm - a.criadaEm);
  return copia.sort(porPrazo);
}

// Devolve os grupos na ordem de exibição: Atrasadas, Hoje, Amanhã, cada data
// futura e, por fim, Sem data. "dia" é a data de hoje (AAAA-MM-DD).
export function agrupar(pendentes, dia) {
  const amanha = somaDias(dia, 1);
  const grupos = [];
  const grupo = (chave, rotulo, atrasado = false) => {
    let g = grupos.find((x) => x.chave === chave);
    if (!g) grupos.push((g = { chave, rotulo, atrasado, tarefas: [] }));
    return g;
  };

  for (const t of [...pendentes].sort(porPrazo)) {
    if (!t.prazo) grupo('sem-data', 'Sem data').tarefas.push(t);
    else if (t.prazo < dia) grupo('atrasadas', 'Atrasadas', true).tarefas.push(t);
    else if (t.prazo === dia) grupo('hoje', 'Hoje').tarefas.push(t);
    else if (t.prazo === amanha) grupo('amanha', 'Amanhã').tarefas.push(t);
    else grupo(t.prazo, rotuloData(t.prazo, dia)).tarefas.push(t);
  }
  return grupos;
}
