// Estado do app e persistência.
// Tudo que toca o armazenamento fica neste arquivo: quando a casca Android
// entrar, a troca de localStorage por arquivo ou SQLite acontece só aqui.

const CHAVE = 'foco:v1';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------- datas
// Sempre no fuso local, no formato AAAA-MM-DD.
// toISOString() devolve UTC e viraria o dia às 21h no horário de Brasília.

export function isoLocal(data = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

export const hoje = () => isoLocal();

export function deIso(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export function somaDias(iso, n) {
  const data = deIso(iso);
  data.setDate(data.getDate() + n);
  return isoLocal(data);
}

// --------------------------------------------------------------- estado
//
// rotinas:      [{ id, nome, itens: [{ id, tipo: 'secao' | 'item', texto, hora }] }]
// marcasRotina: { data: 'AAAA-MM-DD', porRotina: { rotinaId: [itemId] } }  (só o dia corrente)
// habitos:      [{ id, nome, cor, tipo: 'simnao' | 'numero', unidade, meta }]
// registros:    { habitoId: { 'AAAA-MM-DD': 'feito' | 'pulado' | número } }
// listas:       [{ id, nome }]
// tarefas:      [{ id, listaId, titulo, notas, prazo: 'AAAA-MM-DD' | null,
//                  estrela, feita, criadaEm, feitaEm }]

function estadoInicial() {
  const lista = { id: uid(), nome: 'Minhas tarefas' };
  return {
    versao: 1,
    aba: 'rotinas',
    rotinas: [],
    rotinaAtiva: null,
    marcasRotina: { data: hoje(), porRotina: {} },
    habitos: [],
    registros: {},
    listas: [lista],
    listaAtiva: lista.id,
    tarefas: [],
  };
}

function carregar() {
  let bruto = null;
  try {
    bruto = localStorage.getItem(CHAVE);
    if (bruto) return { ...estadoInicial(), ...JSON.parse(bruto) };
  } catch (erro) {
    console.error('Falha ao ler os dados salvos', erro);
    // Guarda o conteúdo ilegível antes que o próximo salvar() o sobrescreva.
    try {
      if (bruto) localStorage.setItem(`${CHAVE}:ilegivel`, bruto);
    } catch { /* sem espaço para a cópia: segue com o estado inicial */ }
  }
  return estadoInicial();
}

export const estado = carregar();

export function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (erro) {
    console.error('Falha ao salvar', erro);
    window.dispatchEvent(new CustomEvent('foco:falha-ao-salvar'));
  }
}

// As marcas das rotinas valem só para o dia corrente: virou o dia, zera.
export function marcasDeHoje() {
  if (estado.marcasRotina.data !== hoje()) {
    estado.marcasRotina = { data: hoje(), porRotina: {} };
  }
  return estado.marcasRotina.porRotina;
}
