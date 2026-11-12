// Servidor estático mínimo para desenvolvimento e para os testes de ponta a ponta.
// Sem dependências. Uso: node tools/serve.mjs   (porta padrão 8137, ou defina PORT)
// Escuta só em 127.0.0.1: o celular acessa pelo cabo com "adb reverse".

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = resolve(fileURLToPath(new URL('../www', import.meta.url)));

const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

async function responder(req, res) {
  let caminho;
  try {
    caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Requisicao invalida');
    return;
  }

  const arquivo = resolve(join(raiz, caminho === '/' ? 'index.html' : caminho));
  if (arquivo !== raiz && !arquivo.startsWith(raiz + sep)) {
    res.writeHead(403).end('Proibido');
    return;
  }

  try {
    const dados = await readFile(arquivo);
    res.writeHead(200, {
      'Content-Type': tipos[extname(arquivo)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(dados);
  } catch {
    res.writeHead(404).end('Nao encontrado');
  }
}

// Sobe o servidor e devolve { servidor, url }. Porta 0 pede uma porta livre ao sistema.
export function iniciarServidor(porta = 0) {
  return new Promise((resolver, rejeitar) => {
    const servidor = createServer(responder);
    servidor.once('error', rejeitar);
    servidor.listen(porta, '127.0.0.1', () => {
      resolver({ servidor, url: `http://localhost:${servidor.address().port}` });
    });
  });
}

// Executado direto pela linha de comando (e não importado por um teste).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { url } = await iniciarServidor(Number(process.env.PORT) || 8137);
  console.log(`Foco em ${url}`);
}
