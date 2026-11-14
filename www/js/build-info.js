// Carimbo do build. No repositório fica sem commit e sem data: é o que o servidor de
// desenvolvimento serve. O build do APK grava o carimbo de verdade na cópia que vai para dentro
// do app (tools/carimbar-build.mjs), sem tocar neste arquivo.
export const BUILD = Object.freeze({ versao: '0.1.0', commit: null, data: null });
