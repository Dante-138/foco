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
