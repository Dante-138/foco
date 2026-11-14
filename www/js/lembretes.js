// Lembretes das tarefas: notificações locais do Android, pelo plugin do Capacitor.
// No navegador o plugin não existe e este módulo não faz nada.
//
// O que deve estar agendado sai de nucleo/lembretes.js (o plano). Aqui o trabalho é
// deixar o sistema igual ao plano: cancelar o que está pendente e agendar o que vale.

import { estado } from './store.js';
import { agoraLocal } from './nucleo/datas.js';
import { planejar } from './nucleo/lembretes.js';

const plugin = () => window.Capacitor?.Plugins?.LocalNotifications ?? null;

export const lembretesDisponiveis = () => plugin() !== null;

// 'granted', 'denied' ou 'prompt' (ainda não foi perguntado). null sem o plugin.
export async function permissaoDeLembretes() {
  try {
    return (await plugin()?.checkPermissions())?.display ?? null;
  } catch {
    return null;
  }
}

export async function pedirPermissaoDeLembretes() {
  try {
    return (await plugin()?.requestPermissions())?.display ?? null;
  } catch {
    return null;
  }
}

// Pergunta pela permissão só quando ela ainda não foi respondida. Chamado quando a
// pessoa salva uma tarefa com data: é a hora em que o pedido faz sentido para ela.
export async function pedirPermissaoSeFaltar() {
  if (!estado.lembretes || !lembretesDisponiveis()) return;
  const atual = await permissaoDeLembretes();
  if (atual === 'prompt' || atual === 'prompt-with-rationale') await pedirPermissaoDeLembretes();
  agendarSincronia();
}

function paraOSistema(lembrete) {
  return {
    id: lembrete.id,
    title: lembrete.titulo,
    body: lembrete.corpo,
    schedule: { at: new Date(`${lembrete.quando}:00`).toISOString(), allowWhileIdle: true },
    // Alarme não exato: pode atrasar alguns minutos, mas não exige a permissão de
    // "Alarmes e lembretes" nem abre a tela dela.
    isExactNotification: false,
  };
}

// Plano já aplicado nesta sessão. Só as duas funções abaixo mexem nele.
let planoAplicado = null;
const planoMudou = (assinatura) => {
  if (assinatura === planoAplicado) return false;
  planoAplicado = assinatura;
  return true;
};
const esquecerPlano = () => {
  planoAplicado = null;
};

export async function sincronizarLembretes() {
  const notificacoes = plugin();
  if (!notificacoes) return;
  const plano = estado.lembretes ? planejar(estado.tarefas, estado.listas, agoraLocal()) : [];
  if (!planoMudou(JSON.stringify(plano))) return;
  try {
    // Sem permissão não agenda, e também não pede: o pedido tem hora certa (ver acima).
    if ((await notificacoes.checkPermissions()).display !== 'granted') {
      esquecerPlano();
      return;
    }
    const { notifications: pendentes } = await notificacoes.getPending();
    if (pendentes.length) await notificacoes.cancel({ notifications: pendentes.map(({ id }) => ({ id })) });
    if (plano.length) await notificacoes.schedule({ notifications: plano.map(paraOSistema) });
  } catch (erro) {
    esquecerPlano(); // tenta de novo na próxima mudança
    console.warn('Lembretes: não foi possível agendar', erro);
  }
}

// As mudanças vêm em rajada (cada toque salva): espera um instante e sincroniza uma vez.
let espera = null;
export function agendarSincronia() {
  clearTimeout(espera);
  espera = setTimeout(sincronizarLembretes, 1200);
}
