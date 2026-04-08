param(
    [int]$InspectPort = 9337,
    [switch]$DebugUi,
    [string]$InstallRoot
)

$ErrorActionPreference = "Stop"

$toolkitRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $toolkitRoot "hotkeys\\custom-shortcuts.json"
$args = @("--port", "$InspectPort", "--root", $toolkitRoot, "--config-path", $configPath)

if ($InstallRoot) {
    $args += @("--install-root", $InstallRoot)
}

if ($DebugUi) {
    $args += "--debug-ui"
}

& node (Join-Path $toolkitRoot "hotkeys\\inject-main.mjs") @args
