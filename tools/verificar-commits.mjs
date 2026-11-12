// Portão das mensagens de commit. Sem dependências.
//
// Uso: node tools/verificar-commits.mjs <base>
//   <base>  ponto de partida da comparação, por exemplo origin/main.
//           Confere os commits de <base>..HEAD.
//
// Variável de ambiente opcional TITULO_PR: título do pull request, conferido
// pela mesma regra (com squash merge, é ele que vira o commit na main).
//
// Regras:
// 1. Assunto no padrão Conventional Commits: tipo(escopo opcional): descrição
// 2. Assunto com no máximo 72 caracteres e sem ponto final
// 3. Nenhuma linha de coautoria ou de "gerado por" na mensagem

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TIPOS = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
const ASSUNTO = new RegExp(`^(${TIPOS.join('|')})(\\([a-z0-9-]+\\))?!?: \\S.*$`);
const TAMANHO_MAXIMO = 72;
// \u{1F916} é o emoji de robô que algumas ferramentas põem na assinatura.
const AUTORIA_DE_TERCEIRO = /^\s*(co-authored-by:|signed-off-by:|generated (with|by)\b)|\u{1F916}/imu;

// Devolve a lista de problemas de um assunto (vazia quando está certo).
export function problemasDoAssunto(assunto) {
  const problemas = [];
  if (!ASSUNTO.test(assunto)) {
    problemas.push(`fora do padrão "tipo(escopo): descrição" (tipos: ${TIPOS.join(', ')})`);
  }
  if (assunto.length > TAMANHO_MAXIMO) {
    problemas.push(`tem ${assunto.length} caracteres (máximo ${TAMANHO_MAXIMO})`);
  }
  if (assunto.endsWith('.')) problemas.push('termina com ponto final');
  return problemas;
}

// Devolve a lista de problemas da mensagem inteira (assunto + corpo).
export function problemasDaMensagem(mensagem) {
  const [assunto = ''] = mensagem.split('\n');
  const problemas = problemasDoAssunto(assunto.trim());
  if (AUTORIA_DE_TERCEIRO.test(mensagem)) problemas.push('contém linha de coautoria ou de "gerado por"');
  return problemas;
}

function commitsDesde(base) {
  // %x00 separa os commits; %x01 separa o hash da mensagem.
  const saida = execFileSync('git', ['log', '--no-merges', '--format=%h%x01%B%x00', `${base}..HEAD`], {
    encoding: 'utf8',
  });
  return saida
    .split('\0')
    .map((bloco) => bloco.trim())
    .filter(Boolean)
    .map((bloco) => {
      const [hash, mensagem] = bloco.split('\x01');
      return { hash, mensagem: mensagem.trim() };
    });
}

function principal() {
  const base = process.argv[2];
  if (!base) {
    console.error('Uso: node tools/verificar-commits.mjs <base>   (exemplo: origin/main)');
    return 2;
  }

  const itens = commitsDesde(base).map(({ hash, mensagem }) => ({
    rotulo: `${hash} ${mensagem.split('\n')[0]}`,
    problemas: problemasDaMensagem(mensagem),
  }));

  const tituloDoPr = process.env.TITULO_PR;
  if (tituloDoPr) {
    itens.push({ rotulo: `título do PR: ${tituloDoPr}`, problemas: problemasDoAssunto(tituloDoPr.trim()) });
  }

  const reprovados = itens.filter((item) => item.problemas.length);
  for (const item of reprovados) {
    console.error(`REPROVADO  ${item.rotulo}`);
    for (const problema of item.problemas) console.error(`           - ${problema}`);
  }
  console.log(`${itens.length} mensagem(ns) conferida(s), ${reprovados.length} reprovada(s).`);
  return reprovados.length ? 1 : 0;
}

// Executado direto pela linha de comando (e não importado por um teste).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = principal();
}
