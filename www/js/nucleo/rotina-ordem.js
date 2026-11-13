// Ordem em que os itens de uma rotina aparecem, e o desfazer das marcas.

// Com "marcados no fim" ligado, dentro de cada seção os itens pendentes vêm primeiro e
// os marcados descem para o fim dela, sem mudar a ordem entre si. As seções não saem
// do lugar, e os itens escritos antes da primeira seção formam um bloco próprio.
// itens: os itens da rotina, na ordem em que foram escritos; marcadas: Set com os ids marcados.
export function emOrdemDeExibicao(itens, marcadas, marcadosNoFim) {
  if (!marcadosNoFim) return itens;

  const saida = [];
  let pendentes = [];
  let feitos = [];
  const fecharBloco = () => {
    saida.push(...pendentes, ...feitos);
    pendentes = [];
    feitos = [];
  };

  for (const item of itens) {
    if (item.tipo === 'secao') {
      fecharBloco();
      saida.push(item);
    } else if (marcadas.has(item.id)) {
      feitos.push(item);
    } else {
      pendentes.push(item);
    }
  }
  fecharBloco();
  return saida;
}

// As marcas do dia ficam guardadas na ordem em que foram feitas, então desfazer é
// tirar a última. Devolve uma lista nova; com a lista vazia, devolve vazia.
export const semAUltimaMarca = (marcas) => marcas.slice(0, -1);
