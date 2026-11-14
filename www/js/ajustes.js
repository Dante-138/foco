// Folha de ajustes do app: aparência, lembretes e backup dos dados.

import { estado, salvar, substituirEstado } from './store.js';
import { hoje } from './nucleo/datas.js';
import { uid } from './nucleo/ids.js';
import { MOTIVO, gerarBackup, lerBackup, resumir } from './nucleo/backup.js';
import { h, abrirFolha, confirmar, campo, avisar, redesenhar } from './ui.js';
import { temaEscolhido, definirTema } from './tema.js';
import {
  agendarSincronia,
  lembretesDisponiveis,
  pedirPermissaoDeLembretes,
  permissaoDeLembretes,
} from './lembretes.js';

const TEMAS = [
  ['escuro', 'Escuro'],
  ['claro', 'Claro'],
  ['sistema', 'Sistema'],
];

const RECUSAS = {
  [MOTIVO.VAZIO]: 'Cole o texto do backup no campo acima.',
  [MOTIVO.ILEGIVEL]: 'Não consegui ler este texto. Confira se ele foi copiado inteiro.',
  [MOTIVO.NAO_E_BACKUP]: 'Este texto não tem dados do Foco (rotinas, hábitos ou tarefas).',
  [MOTIVO.VERSAO_MAIS_NOVA]:
    'Este backup foi feito em uma versão mais nova do app. Atualize o app antes de restaurar.',
};

const contar = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function descrever(resumo) {
  return [
    contar(resumo.rotinas, 'rotina', 'rotinas'),
    contar(resumo.habitos, 'hábito', 'hábitos'),
    contar(resumo.tarefas, 'tarefa', 'tarefas'),
  ].join(', ');
}

// ---------------------------------------------------------------- backup

// Quando o app não consegue copiar sozinho, mostra o texto para a pessoa copiar.
function mostrarParaCopiar(texto) {
  const caixa = h('textarea', { class: 'entrada editor', readOnly: true, value: texto, spellcheck: false });
  const fechar = abrirFolha({
    titulo: 'Copie o texto abaixo',
    corpo: h(
      'div',
      { class: 'folha-form' },
      h('p', { class: 'dica' }, 'Não foi possível copiar automaticamente. Selecione tudo e copie.'),
      caixa,
      h(
        'div',
        { class: 'linha-botoes' },
        h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Fechar'),
      ),
    ),
  });
  caixa.focus();
  caixa.select();
}

async function copiarDados() {
  const texto = gerarBackup(estado);
  try {
    await navigator.clipboard.writeText(texto);
    avisar(`Dados copiados: ${descrever(resumir(estado))}.`);
  } catch {
    mostrarParaCopiar(texto);
  }
}

function abrirRestauracao() {
  const texto = h('textarea', {
    class: 'entrada editor',
    placeholder: 'Cole aqui o texto do backup',
    spellcheck: false,
    autocapitalize: 'off',
  });
  const recusa = h('p', { class: 'dica erro', role: 'alert', hidden: true });

  const aoConferir = async (e) => {
    e.preventDefault();
    const leitura = lerBackup(texto.value, { dia: hoje(), gerarId: uid });
    if (!leitura.ok) {
      recusa.textContent = RECUSAS[leitura.motivo];
      recusa.hidden = false;
      return;
    }
    recusa.hidden = true;

    const pergunta = `Substituir os dados deste aparelho por ${descrever(leitura.resumo)}?`;
    if (!(await confirmar(pergunta, 'Substituir'))) return;

    if (!substituirEstado(leitura.estado)) return;
    fechar();
    redesenhar();
    avisar(
      leitura.correcoes
        ? `Dados restaurados. ${contar(leitura.correcoes, 'item inválido foi corrigido', 'itens inválidos foram corrigidos')}.`
        : 'Dados restaurados.',
    );
  };

  const fechar = abrirFolha({
    titulo: 'Restaurar dados',
    fecharNoFundo: false,
    corpo: h(
      'form',
      { class: 'folha-form', onsubmit: aoConferir },
      campo('Texto do backup', texto),
      recusa,
      h(
        'p',
        { class: 'dica' },
        'Os dados atuais deste aparelho serão substituídos. Antes de trocar, o app mostra o que vai entrar e pede confirmação.',
      ),
      h(
        'div',
        { class: 'linha-botoes' },
        h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'botao cheio' }, 'Conferir'),
      ),
    ),
  });
}

// ------------------------------------------------------------- lembretes

const SITUACAO_DOS_LEMBRETES = {
  granted: 'Tarefa com horário avisa na hora; só com data, às 9h.',
  denied: 'As notificações do Foco estão bloqueadas nas configurações do Android.',
};

function secaoDeLembretes() {
  if (!lembretesDisponiveis()) {
    return h(
      'div',
      { class: 'rotulo' },
      'Lembretes',
      h('p', { class: 'dica' }, 'Os lembretes das tarefas funcionam no app Android.'),
    );
  }

  const situacao = h('p', { class: 'dica' });
  const interruptor = h('button', { type: 'button', class: 'botao contorno', role: 'switch' });
  const permitir = h(
    'button',
    { type: 'button', class: 'botao contorno', hidden: true },
    'Permitir notificações',
  );

  const desenhar = async () => {
    const ligados = estado.lembretes;
    interruptor.setAttribute('aria-checked', String(ligados));
    interruptor.textContent = ligados ? 'Lembretes ligados' : 'Lembretes desligados';
    const permissao = ligados ? await permissaoDeLembretes() : null;
    permitir.hidden = !ligados || permissao === 'granted' || permissao === 'denied';
    situacao.textContent = ligados
      ? (SITUACAO_DOS_LEMBRETES[permissao] ?? 'Falta permitir as notificações.')
      : 'Nenhuma tarefa avisa.';
  };

  interruptor.addEventListener('click', () => {
    estado.lembretes = !estado.lembretes;
    salvar(); // quem salva avisa os lembretes, que agendam ou cancelam tudo
    desenhar();
  });
  permitir.addEventListener('click', async () => {
    await pedirPermissaoDeLembretes();
    agendarSincronia();
    desenhar();
  });
  desenhar();

  return h(
    'div',
    { class: 'rotulo' },
    'Lembretes',
    h('div', { class: 'linha-botoes inicio' }, interruptor, permitir),
    situacao,
  );
}

// ---------------------------------------------------------------- folha

export function abrirAjustes() {
  const segmentos = h('div', { class: 'segmentos', role: 'radiogroup', 'aria-label': 'Aparência' });
  const desenhar = () => {
    segmentos.replaceChildren(
      ...TEMAS.map(([valor, rotulo]) =>
        h(
          'button',
          {
            type: 'button',
            class: `segmento${temaEscolhido() === valor ? ' ativo' : ''}`,
            role: 'radio',
            'aria-checked': String(temaEscolhido() === valor),
            onclick: () => {
              definirTema(valor);
              desenhar();
            },
          },
          rotulo,
        ),
      ),
    );
  };
  desenhar();

  const fechar = abrirFolha({
    titulo: 'Ajustes',
    corpo: h(
      'div',
      { class: 'folha-form' },
      h('div', { class: 'rotulo' }, 'Aparência', segmentos),
      secaoDeLembretes(),
      h(
        'div',
        { class: 'rotulo' },
        'Seus dados',
        h(
          'div',
          { class: 'linha-botoes inicio' },
          h('button', { type: 'button', class: 'botao contorno', onclick: copiarDados }, 'Copiar dados'),
          h(
            'button',
            {
              type: 'button',
              class: 'botao contorno',
              onclick: () => {
                fechar();
                abrirRestauracao();
              },
            },
            'Colar para restaurar',
          ),
        ),
        h(
          'p',
          { class: 'dica' },
          'Copiar dados põe tudo na área de transferência, em texto. Guarde esse texto em um lugar seguro: ele é o seu backup.',
        ),
      ),
      h(
        'div',
        { class: 'linha-botoes' },
        h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Fechar'),
      ),
    ),
  });
}
