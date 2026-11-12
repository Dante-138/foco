# Imagem de build do APK do Foco: JDK 21 e as ferramentas de linha de comando do
# Android, só com a plataforma e o build-tools que o projeto pede. Sem Android Studio.
#
# De onde vêm as versões:
#   Java 21              android/app/capacitor.build.gradle (gerado pelo Capacitor 8)
#   plataforma android-36  compileSdkVersion em android/variables.gradle
#   build-tools 35.0.0   padrão do Android Gradle Plugin 8.13 (android/build.gradle)
#   ferramentas 15859902 página de download do Android Studio, com o SHA-256 de lá
#
# Baixar e instalar o Android SDK exige aceitar a licença do Google:
#   https://developer.android.com/studio/terms
# Por isso a imagem só é construída quando quem chama declara o aceite:
#   --build-arg ACEITO_LICENCA_ANDROID=sim
# O script tools/apk.ps1 só passa esse argumento com a opção -AceitoLicencaAndroid.

# Imagem base fixada pelo conteúdo (digest), não só pela tag.
FROM eclipse-temurin:21-jdk@sha256:0a3f329821dcadf54b2a3033a15e2e9f007069a9db43d7f51897e6b80e726b07

ARG ACEITO_LICENCA_ANDROID=nao
ARG FERRAMENTAS_ZIP=commandlinetools-linux-15859902_latest.zip
ARG FERRAMENTAS_SHA256=4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583
ARG PLATAFORMA=android-36
ARG BUILD_TOOLS=35.0.0

ENV ANDROID_HOME=/opt/android-sdk
ENV BUILD_TOOLS_DIR=${ANDROID_HOME}/build-tools/${BUILD_TOOLS}
ENV PATH="${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin"

# Para antes de baixar qualquer coisa do Android se o aceite não foi declarado.
RUN if [ "${ACEITO_LICENCA_ANDROID}" != "sim" ]; then \
      echo "A licenca do Android SDK nao foi aceita."; \
      echo "Leia https://developer.android.com/studio/terms e use: tools/apk.ps1 -AceitoLicencaAndroid"; \
      exit 1; \
    fi

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip \
 && rm -rf /var/lib/apt/lists/*

# Ferramentas de linha de comando, conferidas pelo SHA-256 publicado.
RUN curl -fsSL -o /tmp/ferramentas.zip "https://dl.google.com/android/repository/${FERRAMENTAS_ZIP}" \
 && echo "${FERRAMENTAS_SHA256}  /tmp/ferramentas.zip" | sha256sum -c - \
 && mkdir -p "${ANDROID_HOME}/cmdline-tools" \
 && unzip -q /tmp/ferramentas.zip -d "${ANDROID_HOME}/cmdline-tools" \
 && mv "${ANDROID_HOME}/cmdline-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/latest" \
 && rm /tmp/ferramentas.zip

# Aceita a licença (declarada acima) e instala só o necessário para compilar.
RUN yes | sdkmanager --licenses > /dev/null \
 && sdkmanager "platforms;${PLATAFORMA}" "build-tools;${BUILD_TOOLS}"

WORKDIR /obra
