#!/usr/bin/env bash
# Roda DENTRO do container de build, chamado por tools/apk.ps1. Não é para o Windows.
#
# Pastas montadas pelo script de fora:
#   /fonte    o repositório, só leitura, com "npx cap sync android" já feito no host
#   /chaves   a keystore e o assinatura.properties, só leitura
#   /saida    onde o APK pronto é deixado
#   /root/.gradle  cache do Gradle (volume foco-gradle)

set -euo pipefail

ASSINATURA=/chaves/assinatura.properties
APK=app/build/outputs/apk/release/app-release.apk

if [ ! -f "$ASSINATURA" ]; then
  echo "Falta $ASSINATURA (veja docker/android/assinatura.properties.exemplo)." >&2
  exit 1
fi

# Copia só o que o Gradle usa e compila no disco do container: compilar direto
# na pasta montada do Windows é muito mais lento.
echo "== Copiando o projeto para o container"
mkdir -p /obra
tar -C /fonte \
  --exclude='android/.gradle' \
  --exclude='android/build' \
  --exclude='android/app/build' \
  --exclude='android/capacitor-cordova-android-plugins/build' \
  --exclude='android/local.properties' \
  -cf - android node_modules/@capacitor capacitor.config.json \
  | tar -C /obra -xf -

cd /obra/android

echo "== Compilando o APK de release (a primeira vez baixa o Gradle e as bibliotecas)"
sh ./gradlew --no-daemon --console=plain -Dorg.gradle.workers.max=2 \
  assembleRelease "-Pfoco.assinatura=$ASSINATURA"

echo "== Conferindo a assinatura"
"$BUILD_TOOLS_DIR/apksigner" verify --print-certs "$APK"

cp "$APK" /saida/foco.apk
echo "== APK pronto em /saida/foco.apk"
