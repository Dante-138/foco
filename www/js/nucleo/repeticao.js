// Tarefas que se repetem: de quanto em quanto tempo e qual é a próxima data.
// repeticao = { cada: 1..99, unidade: 'dia' | 'semana' | 'mes' | 'ano' }

import { deIso, isoLocal, somaDias } from './datas.js';

export const UNIDADES = Object.freeze(['dia', 'semana', 'mes', 'ano']);
export const MAXIMO_DE_INTERVALOS = 99;

export function repeticaoValida(valor) {
  return (
    valor !== null &&
    typeof valor === 'object' &&
    UNIDADES.includes(valor.unidade) &&
    Number.isInteger(valor.cada) &&
    valor.cada >= 1 &&
    valor.cada <= MAXIMO_DE_INTERVALOS
  );
}

// Soma meses mantendo o dia; se o mês de destino é mais curto, fica no último dia dele
// (31 de janeiro mais um mês é 28 ou 29 de fevereiro).
function somaMeses(iso, meses) {
  const origem = deIso(iso);
  const destino = new Date(origem.getFullYear(), origem.getMonth() + meses, 1);
  const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(origem.getDate(), ultimoDia));
  return isoLocal(destino);
}

function umPasso(iso, { cada, unidade }) {
  if (unidade === 'dia') return somaDias(iso, cada);
  if (unidade === 'semana') return somaDias(iso, cada * 7);
  if (unidade === 'mes') return somaMeses(iso, cada);
  return somaMeses(iso, cada * 12);
}

// Data da próxima ocorrência de uma tarefa com prazo em "prazo", concluída no dia "dia".
// Anda de intervalo em intervalo a partir do prazo e para na primeira data que não ficou
// para trás: tarefa diária concluída com um dia de atraso reaparece hoje; tarefa
// semanal concluída com atraso reaparece no dia da semana de sempre.
export function proximaData(prazo, repeticao, dia) {
  let proxima = umPasso(prazo, repeticao);
  while (proxima < dia) proxima = umPasso(proxima, repeticao);
  return proxima;
}

// Texto curto para a interface: "todo dia", "a cada 2 semanas".
const NOMES = {
  dia: ['todo dia', 'dias'],
  semana: ['toda semana', 'semanas'],
  mes: ['todo mês', 'meses'],
  ano: ['todo ano', 'anos'],
};

export function descrever({ cada, unidade }) {
  const [um, varios] = NOMES[unidade];
  return cada === 1 ? um : `a cada ${cada} ${varios}`;
}
