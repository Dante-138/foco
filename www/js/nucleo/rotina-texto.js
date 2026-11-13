// Conversão entre o texto do editor de rotinas e a lista de itens.
// A rotina é editada como texto puro, igual a uma nota: uma linha por item,
// "# Nome" abre uma seção e um horário no começo da linha (22:30) é opcional.

import { uid } from './ids.js';
import { LIMITES } from './esquema.js';

// Restos de checklist colado de outro app, removidos do começo da linha:
// caixa "[ ]" ou "[x]", símbolos de caixa, e marcador de lista seguido de
// espaço ou sozinho na linha. Repete até não sobrar nenhum, para cobrir o
// "- [ ] item" do Markdown. "-5 graus" e "*importante*" ficam intactos:
// colado ao texto, o hífen ou o asterisco não é marcador.
const MARCADOR = /^(?:\[[ xX]?\]\s*|[☐☑✓✔]\s*|[-*•](?:\s+|$))/;
const HORARIO = /^(\d{1,2}):(\d{2})\s+(.+)$/;

function semMarcadores(linha) {
  let texto = linha.trim();
  while (MARCADOR.test(texto)) texto = texto.replace(MARCADOR, '');
  return texto;
}

function linhaParaItem(linha) {
  let texto = semMarcadores(linha);
  if (!texto) return null;

  if (texto.startsWith('#')) {
    texto = texto
      .replace(/^#+\s*/, '')
      .slice(0, LIMITES.textoItem)
      .trim();
    return texto ? { tipo: 'secao', texto, hora: null } : null;
  }

  const m = texto.match(HORARIO);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) {
    const resto = m[3]
      .replace(/^[-–—]\s*/, '')
      .slice(0, LIMITES.textoItem)
      .trim();
    if (resto) return { tipo: 'item', texto: resto, hora: `${m[1].padStart(2, '0')}:${m[2]}` };
  }
  return { tipo: 'item', texto: texto.slice(0, LIMITES.textoItem).trim(), hora: null };
}

// Reaproveita o id de quem manteve o mesmo texto, para a edição não apagar
// as marcas de hoje nem a ligação com um hábito. Mudar só o horário de um item
// preserva as duas coisas; mudar o texto faz dele um item novo, sem ligação.
// Linhas além do limite de itens por rotina são descartadas.
export function textoParaItens(texto, antigos = [], gerarId = uid) {
  const chave = (i) => `${i.tipo}|${i.texto}`;
  const livres = new Map();
  for (const antigo of antigos) {
    const fila = livres.get(chave(antigo)) ?? [];
    fila.push(antigo);
    livres.set(chave(antigo), fila);
  }
  return texto
    .split(/\r?\n/)
    .map(linhaParaItem)
    .filter(Boolean)
    .slice(0, LIMITES.itensPorRotina)
    .map((item) => {
      const antigo = livres.get(chave(item))?.shift();
      return { id: antigo?.id ?? gerarId(), ...item, habitoId: antigo?.habitoId ?? null };
    });
}

export function itensParaTexto(itens) {
  return itens
    .map((i, n) => {
      if (i.tipo === 'secao') return `${n ? '\n' : ''}# ${i.texto}`;
      return i.hora ? `${i.hora} ${i.texto}` : i.texto;
    })
    .join('\n');
}
