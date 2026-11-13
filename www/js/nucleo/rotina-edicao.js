// Edição de uma rotina direto na lista: inserir, remover e limpar itens e seções.
// Os itens ficam numa lista só, e cada seção vale até a próxima (ver emBlocos em
// rotina-ordem.js). Todas as funções devolvem uma lista nova, sem alterar a recebida,
// e nenhuma muda o id de um item: a marca do dia e a ligação com o hábito ficam.

// "novo" logo depois do item de id "idDeReferencia"; sem a referência, no fim.
export function inserirDepois(itens, idDeReferencia, novo) {
  const posicao = itens.findIndex((item) => item.id === idDeReferencia);
  if (posicao < 0) return [...itens, novo];
  return [...itens.slice(0, posicao + 1), novo, ...itens.slice(posicao + 1)];
}

// "novo" no fim do bloco da seção "idDaSecao", isto é, logo antes da seção seguinte.
// idDaSecao null é o bloco dos itens escritos antes da primeira seção.
export function inserirNoFimDoBloco(itens, idDaSecao, novo) {
  const inicio = idDaSecao === null ? -1 : itens.findIndex((item) => item.id === idDaSecao);
  if (idDaSecao !== null && inicio < 0) return [...itens, novo];
  const seguinte = itens.findIndex((item, i) => i > inicio && item.tipo === 'secao');
  const posicao = seguinte < 0 ? itens.length : seguinte;
  return [...itens.slice(0, posicao), novo, ...itens.slice(posicao)];
}

export const remover = (itens, id) => itens.filter((item) => item.id !== id);

// Fim da edição: textos aparados e cortados no limite; item ou seção sem texto sai.
export function limparVazios(itens, limiteDoTexto) {
  return itens
    .map((item) => ({ ...item, texto: item.texto.trim().slice(0, limiteDoTexto).trim() }))
    .filter((item) => item.texto);
}

// Itens na ordem dos ids recebidos (a ordem em que ficaram na tela depois de arrastar).
// Id desconhecido é ignorado, e item que não está na lista de ids vai para o fim:
// nenhum item se perde por causa de um arraste.
export function naOrdem(itens, ids) {
  const porId = new Map(itens.map((item) => [item.id, item]));
  const ordenados = ids.map((id) => porId.get(id)).filter(Boolean);
  const vistos = new Set(ordenados);
  return [...ordenados, ...itens.filter((item) => !vistos.has(item))];
}
