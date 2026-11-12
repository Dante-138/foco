#!/usr/bin/env bash
# Roda DENTRO do container de build, chamado por tools/apk.ps1. Não é para o Windows.
#
# Pastas montadas pelo script de fora:
#   /fonte    o repositório, só leitura, com "npx cap sync android" já feito no host
#   /chaves   a keystore e o assinatura.properties, só leitura
#   /saida    onde o APK pronto é deixado
#   /root/.gradle  cache do Gradle (volume foco-gradle)
#
# Variável TIPO: "release" (padrão) ou "debug". O de depuração é o mesmo app,
# assinado com a mesma chave, mas inspecionável pelo cabo USB.

set -euo pipefail

TIPO="${TIPO:-release}"
case "$TIPO" in
  release) TAREFA=assembleRelease; DESTINO=/saida/foco.apk ;;
  debug)   TAREFA=assembleDebug;   DESTINO=/saida/foco-debug.apk ;;
  *) echo "TIPO invalido: $TIPO (use release ou debug)" >&2; exit 1 ;;
esac

ASSINATURA=/chaves/assinatura.properties
APK="app/build/outputs/apk/$TIPO/app-$TIPO.apk"

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

echo "== Compilando o APK ($TIPO). A primeira vez baixa o Gradle e as bibliotecas"
sh ./gradlew --no-daemon --console=plain -Dorg.gradle.workers.max=2 \
  "$TAREFA" "-Pfoco.assinatura=$ASSINATURA"

echo "== Conferindo a assinatura"
"$BUILD_TOOLS_DIR/apksigner" verify --print-certs "$APK"

cp "$APK" "$DESTINO"
echo "== APK pronto em $DESTINO"
