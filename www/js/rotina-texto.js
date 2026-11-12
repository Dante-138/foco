// Conversão entre o texto do editor de rotinas e a lista de itens.
// A rotina é editada como texto puro, igual a uma nota: uma linha por item,
// "# Nome" abre uma seção e um horário no começo da linha (22:30) é opcional.

import { uid } from './ids.js';

const MARCADOR = /^(\[[ xX]?\]|[-*•☐☑✓✔])\s*/; // restos de checklist colado de outro app
const HORARIO = /^(\d{1,2}):(\d{2})\s+(.+)$/;

function linhaParaItem(linha) {
  let texto = linha.trim().replace(MARCADOR, '');
  if (!texto) return null;

  if (texto.startsWith('#')) {
    texto = texto.replace(/^#+\s*/, '');
    return texto ? { tipo: 'secao', texto, hora: null } : null;
  }

  const m = texto.match(HORARIO);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) {
    const resto = m[3].replace(/^[-–—]\s*/, '').trim();
    if (resto) return { tipo: 'item', texto: resto, hora: `${m[1].padStart(2, '0')}:${m[2]}` };
  }
  return { tipo: 'item', texto, hora: null };
}

// Reaproveita o id de quem manteve o mesmo texto, para a edição não apagar
// as marcas de hoje. Mudar só o horário de um item preserva a marca.
export function textoParaItens(texto, antigos = [], gerarId = uid) {
  const chave = (i) => `${i.tipo}|${i.texto}`;
  const livres = new Map();
  for (const antigo of antigos) {
    const fila = livres.get(chave(antigo)) ?? [];
    fila.push(antigo.id);
    livres.set(chave(antigo), fila);
  }
  return texto
    .split(/\r?\n/)
    .map(linhaParaItem)
    .filter(Boolean)
    .map((item) => ({ id: livres.get(chave(item))?.shift() ?? gerarId(), ...item }));
}

export function itensParaTexto(itens) {
  return itens
    .map((i, n) => {
      if (i.tipo === 'secao') return `${n ? '\n' : ''}# ${i.texto}`;
      return i.hora ? `${i.hora} ${i.texto}` : i.texto;
    })
    .join('\n');
}
