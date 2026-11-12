<#
.SYNOPSIS
  Gera o APK assinado do Foco dentro do Docker e, no fim, apaga tudo o que criou.

.DESCRIPTION
  Modelo "usar e apagar": nada do Foco fica no Docker depois do build.

  O que este script cria, e só isto ele apaga:
    imagem       foco-android:local
    volume       foco-gradle            (cache do Gradle)
    container    foco-build
    construtor   foco-construtor        (builder do buildx, com o cache de build só dele)
    imagem       moby/buildkit:buildx-stable-1, apenas se não existia antes

  Ele nunca roda "docker system prune", "docker image prune" nem "docker builder prune":
  as imagens e o cache de build que já existem na máquina não são tocados.

  Nada de Java ou Android Studio no Windows: a compilação acontece no container.

.PARAMETER AceitoLicencaAndroid
  Obrigatório para construir. Declara que você leu e aceita a licença do Android SDK
  (https://developer.android.com/studio/terms), exigida para baixar o SDK.

.PARAMETER Chaves
  Pasta, fora do repositório, com foco.jks e assinatura.properties.

.PARAMETER Tipo
  "release" (padrão) gera saida/foco.apk. "debug" gera saida/foco-debug.apk: o mesmo app,
  assinado com a mesma chave, mas inspecionável pelo cabo USB (para os testes no aparelho).
  Um instala por cima do outro sem apagar os dados.

.PARAMETER Manter
  Não apaga nada no fim. Útil para vários builds seguidos; termine com -Limpar.
  Com a imagem já construída, o build seguinte reaproveita a imagem e o cache do Gradle.

.PARAMETER Reconstruir
  Constrói a imagem de novo mesmo que ela já exista (depois de mudar o Dockerfile).

.PARAMETER Limpar
  Só apaga o que builds anteriores deixaram. Não constrói nada.

.PARAMETER Simular
  Mostra os comandos que seriam executados, sem executar nenhum que altere algo.

.EXAMPLE
  pwsh tools/apk.ps1 -AceitoLicencaAndroid
#>
[CmdletBinding()]
param(
    [switch]$AceitoLicencaAndroid,
    [ValidateSet('release', 'debug')][string]$Tipo = 'release',
    [string]$Chaves = 'C:\dev\foco-chaves',
    [switch]$Manter,
    [switch]$Reconstruir,
    [switch]$Limpar,
    [switch]$Simular
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Raiz = Split-Path -Parent $PSScriptRoot
$Saida = Join-Path $Raiz 'saida'
$Estado = Join-Path $Saida '.docker-estado.json'

$Imagem = 'foco-android:local'
$Volume = 'foco-gradle'
$Container = 'foco-build'
$Construtor = 'foco-construtor'
$ImagemBuildkit = 'moby/buildkit:buildx-stable-1'

function Etapa([string]$Texto) {
    Write-Host ''
    Write-Host "== $Texto" -ForegroundColor Cyan
}

# Executa um comando que altera algo. Em -Simular, só mostra.
function Rodar([string]$Programa, [string[]]$Argumentos) {
    Write-Host "> $Programa $($Argumentos -join ' ')" -ForegroundColor DarkGray
    if ($Simular) { return }
    & $Programa @Argumentos
    if ($LASTEXITCODE -ne 0) { throw "$Programa terminou com código $LASTEXITCODE" }
}

# Consultas: só leem, então rodam mesmo em -Simular.
function ExisteImagem([string]$Nome) { docker image inspect $Nome *> $null; return $LASTEXITCODE -eq 0 }
function ExisteVolume([string]$Nome) { docker volume inspect $Nome *> $null; return $LASTEXITCODE -eq 0 }
function ExisteContainer([string]$Nome) { docker container inspect $Nome *> $null; return $LASTEXITCODE -eq 0 }
function ExisteConstrutor([string]$Nome) { docker buildx inspect $Nome *> $null; return $LASTEXITCODE -eq 0 }

# Apaga só o que este script cria, pelo nome. Nenhum comando de "prune".
function Limpar-Tudo {
    Etapa 'Apagando o que o Foco criou no Docker'

    $buildkitExistia = $false
    if (Test-Path $Estado) {
        $buildkitExistia = [bool](Get-Content $Estado -Raw | ConvertFrom-Json).buildkitExistia
    }

    if (ExisteContainer $Container) { Rodar docker @('rm', '--force', $Container) }
    if (ExisteImagem $Imagem) { Rodar docker @('rmi', $Imagem) }
    if (ExisteVolume $Volume) { Rodar docker @('volume', 'rm', $Volume) }
    # Remover o construtor apaga o container dele e todo o cache de build dele.
    if (ExisteConstrutor $Construtor) { Rodar docker @('buildx', 'rm', '--force', $Construtor) }
    if (-not $buildkitExistia -and (ExisteImagem $ImagemBuildkit)) { Rodar docker @('rmi', $ImagemBuildkit) }

    if (-not $Simular -and (Test-Path $Estado)) { Remove-Item $Estado }
    Write-Host 'Limpeza concluída. Imagens e cache que já existiam não foram tocados.'
}

# ------------------------------------------------------------------ início

docker version --format '{{.Server.Version}}' *> $null
if ($LASTEXITCODE -ne 0) { throw 'O Docker não respondeu. Abra o Docker Desktop e tente de novo.' }

if ($Limpar) {
    Limpar-Tudo
    return
}

if (-not $AceitoLicencaAndroid) {
    Write-Host 'Para baixar o Android SDK é preciso aceitar a licença do Google:'
    Write-Host '  https://developer.android.com/studio/terms'
    Write-Host 'Depois de ler, rode de novo com:  pwsh tools/apk.ps1 -AceitoLicencaAndroid'
    exit 2
}

# Só confere se os arquivos existem. O conteúdo deles nunca é lido aqui.
$faltando = @('foco.jks', 'assinatura.properties') | Where-Object { -not (Test-Path (Join-Path $Chaves $_)) }
if ($faltando) {
    $mensagem = "Falta em ${Chaves}: $($faltando -join ', '). Veja docker/android/assinatura.properties.exemplo."
    if ($Simular) { Write-Warning $mensagem } else { throw $mensagem }
}

try {
    Etapa 'Preparando o projeto no Windows'
    Push-Location $Raiz
    try {
        if (-not (Test-Path (Join-Path $Raiz 'node_modules\@capacitor\android'))) {
            Rodar npm @('ci', '--ignore-scripts')
        }
        # Copia www/ para dentro do projeto Android e atualiza a configuração nativa.
        Rodar npx @('cap', 'sync', 'android')
    }
    finally { Pop-Location }

    if (-not $Simular) { New-Item -ItemType Directory -Force $Saida | Out-Null }

    # Anota o que já existia, para a limpeza não apagar o que não é do Foco.
    if (-not (Test-Path $Estado)) {
        $anotacao = @{ buildkitExistia = (ExisteImagem $ImagemBuildkit) } | ConvertTo-Json
        Write-Host "anotado: imagem do buildkit já existia = $((ExisteImagem $ImagemBuildkit))" -ForegroundColor DarkGray
        if (-not $Simular) { Set-Content -Path $Estado -Value $anotacao -Encoding utf8 }
    }

    if ((ExisteImagem $Imagem) -and -not $Reconstruir) {
        Etapa 'Imagem de build já existe: reaproveitando (use -Reconstruir para refazer)'
    }
    else {
        Etapa 'Construindo a imagem de build (baixa o JDK e o Android SDK)'
        # Construtor próprio: o cache de build fica isolado e some junto com ele.
        if (-not (ExisteConstrutor $Construtor)) {
            Rodar docker @('buildx', 'create', '--name', $Construtor, '--driver', 'docker-container')
        }
        Rodar docker @(
            'buildx', 'build', '--builder', $Construtor, '--load',
            '--build-arg', 'ACEITO_LICENCA_ANDROID=sim',
            '--tag', $Imagem,
            (Join-Path $Raiz 'docker\android')
        )
    }

    Etapa "Compilando o APK ($Tipo) no container"
    if (-not (ExisteVolume $Volume)) { Rodar docker @('volume', 'create', $Volume) }
    if (ExisteContainer $Container) { Rodar docker @('rm', '--force', $Container) }
    Rodar docker @(
        'run', '--rm', '--name', $Container,
        '--env', "TIPO=$Tipo",
        '--volume', "${Raiz}:/fonte:ro",
        '--volume', "${Chaves}:/chaves:ro",
        '--volume', "${Saida}:/saida",
        '--volume', "${Volume}:/root/.gradle",
        $Imagem, 'bash', '/fonte/tools/apk-no-container.sh'
    )

    $apk = Join-Path $Saida ($Tipo -eq 'debug' ? 'foco-debug.apk' : 'foco.apk')
    if (-not $Simular) {
        $arquivo = Get-Item $apk
        Etapa 'APK pronto'
        Write-Host ("arquivo : {0}" -f $arquivo.FullName)
        Write-Host ("tamanho : {0:N1} MB" -f ($arquivo.Length / 1MB))
        Write-Host ("SHA-256 : {0}" -f (Get-FileHash $apk -Algorithm SHA256).Hash)
        Write-Host ''
        Write-Host 'Para instalar no celular ligado por USB:'
        Write-Host "  adb install -r `"$apk`""
    }
}
finally {
    if ($Manter) {
        Write-Host ''
        Write-Host 'Opção -Manter: imagem, volume e construtor ficaram no Docker.' -ForegroundColor Yellow
        Write-Host 'Quando terminar, rode:  pwsh tools/apk.ps1 -Limpar' -ForegroundColor Yellow
    }
    else {
        Limpar-Tudo
    }
}
