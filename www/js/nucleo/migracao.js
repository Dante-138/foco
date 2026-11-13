// Atualização dos dados salvos por versões anteriores do app.
// A migração roda antes da validação (esquema.js) e recebe dados ainda não
// conferidos, então cada passo precisa tolerar campos ausentes ou malformados.

export const VERSAO = 4;

// A v1 guardava a cor do hábito como hexadecimal. A v2 guarda a chave da
// paleta, para a cor acompanhar o tema claro ou escuro.
const CORES_V1 = {
  '#ffd95a': 'amarelo',
  '#ff9f5a': 'laranja',
  '#ff6b6b': 'vermelho',
  '#f472a6': 'rosa',
  '#b09cf2': 'lilas',
  '#5aaaf5': 'azul',
  '#4fd1c5': 'ciano',
  '#6fd08c': 'verde',
  '#f2f2f2': 'neutro',
};

function v1ParaV2(dados) {
  if (!Array.isArray(dados.habitos)) return;
  for (const habito of dados.habitos) {
    // Cor fora da tabela fica como está: a validação troca pela cor padrão.
    if (habito && Object.hasOwn(CORES_V1, habito.cor)) habito.cor = CORES_V1[habito.cor];
  }
}

// A v3 acrescenta o arquivamento de hábitos, os filtros da grade e a ordem das
// tarefas. Não há o que converter: os campos novos nascem com o valor padrão na
// validação (esquema.js), que reproduz o comportamento de antes. O número sobe
// para uma versão antiga do app não abrir estes dados e apagar, ao gravar, os
// campos que ela não conhece.

// A v4 acrescenta, nas rotinas, a opção de mandar os itens marcados para o fim e, nas
// tarefas, o horário. Como na v3, não há o que converter: os campos novos nascem com o
// valor padrão na validação.

// Cada passo sobe uma versão. Altera e devolve o próprio objeto.
// Quem chama garante que dados.versao é um inteiro entre 1 e VERSAO.
export function migrar(dados) {
  if (dados.versao < 2) {
    v1ParaV2(dados);
    dados.versao = 2;
  }
  if (dados.versao < 3) dados.versao = 3;
  if (dados.versao < 4) dados.versao = 4;
  return dados;
}
