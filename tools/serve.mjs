// Servidor estático mínimo para desenvolvimento, sem dependências.
// Uso: node tools/serve.mjs   (porta padrão 8137, ou defina PORT)
// Escuta só em 127.0.0.1: o celular acessa pelo cabo com "adb reverse".

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(fileURLToPath(new URL('../www', import.meta.url)));
const porta = Number(process.env.PORT) || 8137;

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

createServer(async (req, res) => {
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
    });
    res.end(dados);
  } catch {
    res.writeHead(404).end('Nao encontrado');
  }
}).listen(porta, '127.0.0.1', () => {
  console.log(`Foco em http://localhost:${porta}`);
});
