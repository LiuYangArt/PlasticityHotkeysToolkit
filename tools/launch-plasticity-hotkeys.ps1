param(
    [ValidateSet("beta", "stable")]
    [string]$Channel,
    [int]$InspectPort = 9337,
    [switch]$Isolated,
    [switch]$DebugUi,
    [string]$InstallRoot
)

$ErrorActionPreference = "Stop"

function Get-ChannelSpec {
    param([string]$Name)

    switch ($Name) {
        "beta" {
            return [pscustomobject]@{
                Channel        = "beta"
                DefaultRoot    = Join-Path $env:LOCALAPPDATA "plasticity-beta"
                ProcessName    = "plasticity-beta.exe"
                ExecutableName = "plasticity-beta.exe"
                PackageRegex   = 'plasticity-beta-(.+)-full\.nupkg'
            }
        }
        "stable" {
            return [pscustomobject]@{
                Channel        = "stable"
                DefaultRoot    = Join-Path $env:LOCALAPPDATA "Plasticity"
                ProcessName    = "Plasticity.exe"
                ExecutableName = "Plasticity.exe"
                PackageRegex   = 'Plasticity-(.+)-full\.nupkg'
            }
        }
    }

    throw "Unsupported channel: $Name"
}

function Resolve-CandidateRoot {
    param([string[]]$Candidates)

    foreach ($candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        $expanded = [Environment]::ExpandEnvironmentVariables($candidate)
        if (-not (Test-Path -LiteralPath $expanded)) {
            continue
        }

        return (Resolve-Path -LiteralPath $expanded).Path
    }

    throw "Could not resolve a Plasticity install root."
}

function Get-LatestVersionFromReleases {
    param(
        [string]$RootDir,
        [string]$PackageRegex
    )

    $releasesPath = Join-Path $RootDir "packages\\RELEASES"
    if (-not (Test-Path -LiteralPath $releasesPath)) {
        return $null
    }

    $line = Get-Content -LiteralPath $releasesPath |
        Where-Object { $_ -match $PackageRegex } |
        Select-Object -Last 1

    if (-not $line) {
        return $null
    }

    $match = [regex]::Match($line, $PackageRegex)
    if (-not $match.Success) {
        return $null
    }

    return $match.Groups[1].Value
}

function Resolve-PlasticityExecutable {
    param(
        [string]$RootDir,
        [pscustomobject]$Spec
    )

    $rootExe = Join-Path $RootDir $Spec.ExecutableName
    if (Test-Path -LiteralPath $rootExe) {
        return [pscustomobject]@{
            Path     = $rootExe
            RootDir  = $RootDir
            Strategy = "root-stub"
        }
    }

    $version = Get-LatestVersionFromReleases -RootDir $RootDir -PackageRegex $Spec.PackageRegex
    if ($version) {
        $releaseExe = Join-Path $RootDir ("app-{0}\\{1}" -f $version, $Spec.ExecutableName)
        if (Test-Path -LiteralPath $releaseExe) {
            return [pscustomobject]@{
                Path     = $releaseExe
                RootDir  = $RootDir
                Strategy = "packages-releases"
            }
        }
    }

    $dirs = Get-ChildItem -LiteralPath $RootDir -Directory -Filter "app-*"
    if ($dirs) {
        $latest = $dirs | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
        $appExe = Join-Path $latest.FullName $Spec.ExecutableName
        if (Test-Path -LiteralPath $appExe) {
            return [pscustomobject]@{
                Path     = $appExe
                RootDir  = $RootDir
                Strategy = "latest-app-dir"
            }
        }
    }

    throw "Could not locate $($Spec.ExecutableName) under $RootDir"
}

function Get-InspectProcess {
    param(
        [int]$Port,
        [string]$ProcessName
    )

    Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -eq $ProcessName -and
            $_.CommandLine -match "--inspect=$Port"
        } |
        Select-Object -First 1
}

function Wait-ForInspector {
    param([int]$Port)

    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/json/version" -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                return
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    throw "Inspector on port $Port did not become ready."
}

$spec = Get-ChannelSpec -Name $Channel
$toolkitRoot = Split-Path -Parent $PSScriptRoot
$configFileName = if ($DebugUi) { "custom-shortcuts.debug.json" } else { "custom-shortcuts.json" }
$configPath = Join-Path $toolkitRoot ("hotkeys\\{0}" -f $configFileName)

$candidateRoots = @()
if ($InstallRoot) {
    $candidateRoots += $InstallRoot
}
$candidateRoots += $spec.DefaultRoot

$resolvedInstallRoot = Resolve-CandidateRoot -Candidates $candidateRoots
$exeInfo = Resolve-PlasticityExecutable -RootDir $resolvedInstallRoot -Spec $spec
$inspectProcess = Get-InspectProcess -Port $InspectPort -ProcessName $spec.ProcessName

if (-not $inspectProcess) {
    $runningNormal = Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -eq $spec.ProcessName -and
            $_.CommandLine -notmatch "--inspect="
        } |
        Select-Object -First 1

    if ($runningNormal -and -not $Isolated) {
        throw "$($spec.Channel) Plasticity is already running without --inspect. Close it first, or run with -Isolated."
    }

    $arguments = @("--inspect=$InspectPort")
    if ($Isolated) {
        $tempProfile = Join-Path $env:TEMP ("plasticity-hotkeys-{0}-{1}" -f $spec.Channel, $InspectPort)
        if (-not (Test-Path -LiteralPath $tempProfile)) {
            New-Item -ItemType Directory -Path $tempProfile | Out-Null
        }
        $arguments += "--user-data-dir=$tempProfile"
    }

    Start-Process -FilePath $exeInfo.Path -ArgumentList $arguments -WorkingDirectory $exeInfo.RootDir | Out-Null
    Wait-ForInspector -Port $InspectPort
}

& node (Join-Path $toolkitRoot "hotkeys\\inject-main.mjs") --port $InspectPort --root $toolkitRoot --config-path $configPath --install-root $resolvedInstallRoot --launch-strategy ("{0}:{1}" -f $spec.Channel, $exeInfo.Strategy)
