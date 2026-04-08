param(
    [string]$TargetRoot = "$env:LOCALAPPDATA\\PlasticityHotkeysToolkit"
)

$ErrorActionPreference = "Stop"

$toolkitRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = [Environment]::ExpandEnvironmentVariables($TargetRoot)

$itemsToCopy = @(
    ".gitignore",
    ".gitattributes",
    "README.md",
    "docs",
    "start-plasticity-beta.cmd",
    "start-plasticity-stable.cmd",
    "hotkeys",
    "tools"
)

$stalePaths = @(
    "start-plasticity-hotkeys.cmd",
    "start-plasticity-hotkeys-debug.cmd",
    "start-plasticity-hotkeys.ps1",
    "debug-hotkeys-status.cmd",
    "debug-hotkeys-status.ps1",
    "install-hotkeys-toolkit.cmd",
    "install-hotkeys-toolkit.ps1"
)

if (-not (Test-Path -LiteralPath $targetRoot)) {
    New-Item -ItemType Directory -Path $targetRoot | Out-Null
}

foreach ($relativePath in $stalePaths) {
    $stalePath = Join-Path $targetRoot $relativePath
    if (Test-Path -LiteralPath $stalePath) {
        Remove-Item -LiteralPath $stalePath -Recurse -Force
    }
}

foreach ($relativePath in $itemsToCopy) {
    $sourcePath = Join-Path $toolkitRoot $relativePath
    $destinationPath = Join-Path $targetRoot $relativePath

    $resolvedSource = [System.IO.Path]::GetFullPath($sourcePath)
    $resolvedDestination = [System.IO.Path]::GetFullPath($destinationPath)

    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Missing source path: $sourcePath"
    }

    if ($resolvedSource -eq $resolvedDestination) {
        continue
    }

    if (Test-Path -LiteralPath $sourcePath -PathType Container) {
        if (Test-Path -LiteralPath $destinationPath) {
            Remove-Item -LiteralPath $destinationPath -Recurse -Force
        }
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse -Force
        continue
    }

    $destinationDir = Split-Path -Parent $destinationPath
    if (-not (Test-Path -LiteralPath $destinationDir)) {
        New-Item -ItemType Directory -Path $destinationDir | Out-Null
    }

    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

[pscustomobject]@{
    ok             = $true
    targetRoot     = $targetRoot
    betaLauncher   = Join-Path $targetRoot "start-plasticity-beta.cmd"
    stableLauncher = Join-Path $targetRoot "start-plasticity-stable.cmd"
    betaAppRoot    = Join-Path $env:LOCALAPPDATA "plasticity-beta"
    stableAppRoot  = Join-Path $env:LOCALAPPDATA "Plasticity"
} | ConvertTo-Json -Depth 4
