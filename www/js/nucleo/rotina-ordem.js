// Como os itens de uma rotina aparecem na tela, e o que as ações em bloco mudam:
// marcar ou desmarcar a seção inteira e desfazer.

// Agrupa os itens em blocos: cada seção com os itens que vêm depois dela. Os itens
// escritos antes da primeira seção formam um bloco sem seção (secao: null).
export function emBlocos(itens) {
  const blocos = [];
  let atual = null;
  for (const item of itens) {
    if (item.tipo === 'secao') {
      atual = { secao: item, itens: [] };
      blocos.push(atual);
    } else {
      if (!atual) {
        atual = { secao: null, itens: [] };
        blocos.push(atual);
      }
      atual.itens.push(item);
    }
  }
  return blocos;
}

// As duas áreas da tela, como na lista do Google Keep:
//   pendentes: cada bloco com os itens que faltam;
//   marcados:  cada bloco com os itens já marcados (o nome da seção se repete aqui).
// Bloco sem item em uma área não aparece nela; seção que não tem item nenhum fica em
// "pendentes". Com a opção desligada, tudo fica em "pendentes", na ordem escrita.
// marcadas: Set com os ids dos itens marcados hoje.
export function emAreas(itens, marcadas, marcadosNoFim) {
  const blocos = emBlocos(itens);
  if (!marcadosNoFim) return { pendentes: blocos, marcados: [] };

  const pendentes = [];
  const marcados = [];
  for (const { secao, itens: doBloco } of blocos) {
    const faltam = doBloco.filter((item) => !marcadas.has(item.id));
    const feitos = doBloco.filter((item) => marcadas.has(item.id));
    if (faltam.length || !feitos.length) pendentes.push({ secao, itens: faltam });
    if (feitos.length) marcados.push({ secao, itens: feitos });
  }
  return { pendentes, marcados };
}

// As marcas do dia ficam guardadas na ordem em que foram feitas. As três funções abaixo
// devolvem uma lista nova de marcas, sem alterar a recebida.

// Marcar a seção inteira: os itens do bloco que ainda não estavam marcados entram no fim.
export function marcarBloco(marcas, bloco) {
  const jaMarcados = new Set(marcas);
  return [...marcas, ...bloco.itens.map((item) => item.id).filter((id) => !jaMarcados.has(id))];
}

// Desmarcar a seção inteira: saem as marcas de todos os itens do bloco.
export function desmarcarBloco(marcas, bloco) {
  const doBloco = new Set(bloco.itens.map((item) => item.id));
  return marcas.filter((id) => !doBloco.has(id));
}

// Desfazer: saem as últimas marcas. "quantas" é 1 para um item, ou o tamanho do lote
// quando a seção foi marcada de uma vez.
export function semAsUltimas(marcas, quantas = 1) {
  return marcas.slice(0, Math.max(0, marcas.length - quantas));
}
