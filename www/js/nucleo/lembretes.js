// Plano de lembretes: quais notificações devem estar agendadas para as tarefas pendentes.
// Lógica pura. Quem fala com o sistema de notificações é js/lembretes.js.

// Tarefa com data e sem horário avisa de manhã, como no Google Tasks.
export const HORA_PADRAO = '09:00';

// O Android limita os alarmes por app; o plano fica com os lembretes mais próximos.
export const MAXIMO_DE_LEMBRETES = 60;

const TAMANHO_DA_NOTA = 120;

// Número estável, de 1 a 2^30, tirado do id da tarefa (FNV-1a): é o id da notificação
// no sistema, que só aceita inteiro positivo de 32 bits com sinal. A mesma tarefa dá
// sempre o mesmo número.
export function idDaNotificacao(idDaTarefa) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < idDaTarefa.length; i += 1) {
    hash ^= idDaTarefa.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 2) + 1; // 30 bits mais um: nunca zero, nunca passa do limite
}

// Momento do lembrete, em texto local "AAAA-MM-DDTHH:MM". Nesse formato a ordem
// alfabética é a ordem do relógio, então dá para comparar como texto.
const momento = (tarefa) => `${tarefa.prazo}T${tarefa.hora ?? HORA_PADRAO}`;

function corpo(tarefa, nomeDaLista) {
  const nota = tarefa.notas.split('\n')[0].trim();
  const resumo = nota.length > TAMANHO_DA_NOTA ? `${nota.slice(0, TAMANHO_DA_NOTA - 1).trimEnd()}…` : nota;
  return [nomeDaLista, resumo].filter(Boolean).join(' · ');
}

// tarefas e listas: do estado do app. agora: momento atual, "AAAA-MM-DDTHH:MM" local.
// Devolve os lembretes das tarefas pendentes com prazo cujo momento ainda não passou,
// do mais próximo para o mais distante, no máximo MAXIMO_DE_LEMBRETES:
//   [{ id, tarefaId, titulo, corpo, quando }]
export function planejar(tarefas, listas, agora) {
  const nomes = new Map(listas.map((lista) => [lista.id, lista.nome]));
  const usados = new Set();
  const plano = [];
  const futuras = tarefas
    .filter((t) => !t.feita && t.prazo && momento(t) > agora)
    .sort((a, b) => momento(a).localeCompare(momento(b)) || a.criadaEm - b.criadaEm);

  for (const tarefa of futuras) {
    if (plano.length === MAXIMO_DE_LEMBRETES) break;
    const id = idDaNotificacao(tarefa.id);
    if (usados.has(id)) continue; // dois ids de tarefa com o mesmo número: fica o lembrete mais próximo
    usados.add(id);
    plano.push({
      id,
      tarefaId: tarefa.id,
      titulo: tarefa.titulo,
      corpo: corpo(tarefa, nomes.get(tarefa.listaId)),
      quando: momento(tarefa),
    });
  }
  return plano;
}
