// Atualização dos dados salvos por versões anteriores do app.

export const VERSAO = 2;

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

// Cada bloco sobe uma versão. Altera e devolve o próprio objeto.
export function migrar(dados) {
  if (dados.versao < 2) {
    for (const habito of dados.habitos) habito.cor = CORES_V1[habito.cor] ?? 'azul';
    dados.versao = 2;
  }
  return dados;
}
