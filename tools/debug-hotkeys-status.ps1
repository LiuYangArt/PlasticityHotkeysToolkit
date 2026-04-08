param(
    [int]$InspectPort = 9337,
    [switch]$DebugUi,
    [string]$InstallRoot
)

$ErrorActionPreference = "Stop"

$toolkitRoot = Split-Path -Parent $PSScriptRoot
$configFileName = if ($DebugUi) { "custom-shortcuts.debug.json" } else { "custom-shortcuts.json" }
$configPath = Join-Path $toolkitRoot ("hotkeys\\{0}" -f $configFileName)
$args = @("--port", "$InspectPort", "--root", $toolkitRoot, "--config-path", $configPath)

if ($InstallRoot) {
    $args += @("--install-root", $InstallRoot)
}

& node (Join-Path $toolkitRoot "hotkeys\\inject-main.mjs") @args
