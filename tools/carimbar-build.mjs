// Grava o carimbo do build (versão, commit e data) na cópia do app web que vai para dentro do
// APK. Roda depois do "npx cap sync android", que é quem cria essa cópia; o arquivo do
// repositório (www/js/build-info.js) não é tocado. Sem dependências.
//
// Uso: node tools/carimbar-build.mjs [<destino>]
//   <destino>  arquivo a regravar (padrão: a cópia dentro do projeto Android). Precisa existir.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DESTINO_PADRAO = `${RAIZ}android/app/src/main/assets/public/js/build-info.js`;

const git = (...argumentos) => execFileSync('git', argumentos, { cwd: RAIZ, encoding: 'utf8' }).trim();

// Hora local de quem compila, até o minuto: 'AAAA-MM-DDTHH:MM'.
function agora() {
  const d = new Date();
  const dois = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

function principal() {
  const destino = process.argv[2] ?? DESTINO_PADRAO;
  if (!existsSync(destino)) {
    console.error(`Não achei ${destino}. Rode "npx cap sync android" antes.`);
    return 1;
  }
  const { version: versao } = JSON.parse(readFileSync(`${RAIZ}package.json`, 'utf8'));
  // "+" no fim: havia mudança não gravada em commit na hora do build.
  const commit = git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain') ? '+' : '');
  const build = { versao, commit, data: agora() };
  writeFileSync(
    destino,
    `// Gerado por tools/carimbar-build.mjs no build. Não editar.\nexport const BUILD = Object.freeze(${JSON.stringify(build)});\n`,
    'utf8',
  );
  console.log(`Carimbo do build: ${versao} ${commit} ${build.data}`);
  return 0;
}

process.exitCode = principal();
