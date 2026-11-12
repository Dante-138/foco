// Paleta dos hábitos. O hábito guarda a chave; o tom de cada tema vem das
// variáveis --cor-<chave> em css/app.css. "Neutro" é branco no tema escuro e
// preto no claro.

export const CORES = Object.freeze([
  { chave: 'amarelo', nome: 'Amarelo' },
  { chave: 'laranja', nome: 'Laranja' },
  { chave: 'vermelho', nome: 'Vermelho' },
  { chave: 'rosa', nome: 'Rosa' },
  { chave: 'lilas', nome: 'Lilás' },
  { chave: 'azul', nome: 'Azul' },
  { chave: 'ciano', nome: 'Ciano' },
  { chave: 'verde', nome: 'Verde' },
  { chave: 'neutro', nome: 'Neutro' },
]);

export const COR_PADRAO = 'azul';

const CHAVES = new Set(CORES.map((c) => c.chave));

export const corValida = (chave) => CHAVES.has(chave);
