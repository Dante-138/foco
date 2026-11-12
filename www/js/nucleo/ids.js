// Identificadores curtos e únicos para rotinas, itens, hábitos, listas e tarefas.
// Formato: instante em base 36 + contador da sessão (4 dígitos) + sorteio (4 dígitos).
// O contador garante ids diferentes mesmo quando vários são gerados no mesmo
// milissegundo; o instante e o sorteio separam sessões e abas diferentes.

const FAIXA = 36 ** 4;

let contador = 0;

export function uid() {
  contador = (contador + 1) % FAIXA;
  const parte = (n) => n.toString(36).padStart(4, '0');
  return Date.now().toString(36) + parte(contador) + parte(Math.floor(Math.random() * FAIXA));
}
