# ABD Ecosistema AUDIT - UNIFIED CENTRALIZED AUDIT ENGINE
# Sequential execution with clear status reporting and cache cleansing.

CLS
$LogFile = "abd-audit-results.log"
$GlobalStatus = $true
$ArchGuardPath = "$PSScriptRoot/arch-guard.mjs"

# Clean log file initially
if (Test-Path $LogFile) { Remove-Item $LogFile -Force -ErrorAction SilentlyContinue }
"ABD SYSTEM AUDIT REPORT - $(Get-Date)" | Out-File -FilePath $LogFile -Encoding utf8

# Helper to append logs safely to disk with lock-resilience
function Write-AuditLog {
    param([string]$Text)
    try {
        $Text | Out-File -FilePath $LogFile -Append -Encoding utf8 -ErrorAction Stop
    } catch {
        # Silent failover in case of file locks by IDEs/editors
    }
}

# Read package.json to determine if we are in library mode or client mode
$isLibrary = $false
$appName = "Unknown"
if (Test-Path "package.json") {
    try {
        $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
        $appName = $pkg.name
        # Match styles, satellite-sdk, or any packages ending with -sdk or -widgets as library
        if ($pkg.name -eq "@abd/styles" -or $pkg.name -eq "@ajabadia/styles" -or $pkg.name -eq "@abd/satellite-sdk" -or $pkg.name -eq "@abd/ecosystem-widgets" -or $pkg.name -like "*-sdk" -or $pkg.name -like "@abd/*-sdk" -or $pkg.name -like "@ajabadia/*-sdk" -or $pkg.name -like "*-widgets" -or $pkg.name -like "@abd/*-widgets" -or $pkg.name -like "@ajabadia/*-widgets") {
            $isLibrary = $true
        }
    } catch {
        $isLibrary = $false
    }
}

# 🧹 Cache cleansing: Always remove .next folder to prevent false negatives in TS/ESLint cache
if (-not $isLibrary) {
    if (Test-Path ".next") {
        Write-Host "[0/6 Cache Cleansing]" -ForegroundColor Cyan
        Write-Host "  > Purging .next directory to ensure clean validation... " -NoNewline -ForegroundColor Gray
        Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "CLEANED [OK]" -ForegroundColor Green
    }
}

function Run-AuditStep {
    param(
        [string]$Name,
        [string]$ExecCmd,
        [string[]]$StepArgs
    )
    
    Write-Host "`n[$Name] " -ForegroundColor Cyan
    Write-Host "  > In progress... " -NoNewline -ForegroundColor Gray
    
    $errorsCount = 0
    $warningsCount = 0
    
    # Capture both stdout and stderr (2>&1)
    $global:LASTEXITCODE = 0
    if ($ExecCmd -eq "node") {
        $out = & node $StepArgs 2>&1
    } elseif ($ExecCmd -eq "pnpm") {
        $joinedArgs = $StepArgs -join " "
        $out = Invoke-Expression "cmd /c pnpm $joinedArgs" 2>&1
    } elseif ($ExecCmd -eq "npm") {
        $joinedArgs = $StepArgs -join " "
        $out = Invoke-Expression "cmd /c npm $joinedArgs" 2>&1
    } elseif ($ExecCmd -eq "npx") {
        $joinedArgs = $StepArgs -join " "
        $out = Invoke-Expression "cmd /c npx $joinedArgs" 2>&1
    } else {
        $out = & $ExecCmd $StepArgs 2>&1
    }
    
    $exitCode = $LASTEXITCODE
    
    # Parse results from output
    $progressLine = $out | Where-Object { $_ -like "PROGRESS:*" } | Select-Object -Last 1
    if ($progressLine) {
        $parts = $progressLine.Split(':')
        if ($parts.Count -ge 4) { $errorsCount = $parts[3] }
        if ($parts.Count -ge 5) { $warningsCount = $parts[4] }
    }
    
    if ($exitCode -eq 0) {
        Write-Host "`r  -> PASSED [OK] ($errorsCount errors, $warningsCount warnings)".PadRight(60) -ForegroundColor Green
        Write-AuditLog -Text "`n[PHASE:SUCCESS] [$Name]: Passed successfully with $errorsCount errors and $warningsCount warnings."
    } else {
        $errDisplay = $errorsCount
        if ($errorsCount -eq 0) { $errDisplay = "Technical" }
        Write-Host "`r  -> FAILED [!!] ($errDisplay errors detected, $warningsCount warnings)".PadRight(60) -ForegroundColor Red
        $script:GlobalStatus = $false
        
        # Write failure dump to log
        Write-AuditLog -Text "`n[PHASE:FAILED] [$Name]: Failed with exit code $exitCode ($errDisplay errors detected, $warningsCount warnings)."
        Write-AuditLog -Text "--- RAW ERROR DETAIL START ---"
        if ($out) {
            foreach ($line in $out) {
                if ($line -notlike "PROGRESS:*") {
                    Write-AuditLog -Text $line
                }
            }
        } else {
            Write-AuditLog -Text "No output captured."
        }
        Write-AuditLog -Text "--- RAW ERROR DETAIL END ---`n"
    }
}

if ($isLibrary) {
    # --- LIBRARY AUDIT (4 PHASES) ---
    Write-Host "`n[$appName AUDIT] Starting 4-Phase Library Certification..." -ForegroundColor White -BackgroundColor DarkMagenta
    
    if (Test-Path $ArchGuardPath) {
        Run-AuditStep -Name "1/4 Structural Audit" -ExecCmd "node" -StepArgs @($ArchGuardPath, "structural")
        Run-AuditStep -Name "2/4 Purity & Types  " -ExecCmd "node" -StepArgs @($ArchGuardPath, "purity")
    } else {
        Write-Host "`nWarning: arch-guard.mjs not found at $ArchGuardPath. Skipping structural audits." -ForegroundColor Yellow
    }
    
    # Type Safety (TSC)
    $tscPath = "node_modules/typescript/bin/tsc"
    if (Test-Path $tscPath) {
        Run-AuditStep -Name "3/4 Type Safety (TSC)" -ExecCmd "node" -StepArgs @($tscPath, "--noEmit")
    } else {
        Run-AuditStep -Name "3/4 Type Safety (TSC)" -ExecCmd "npx" -StepArgs @("tsc", "--noEmit")
    }
    
    # Build Check
    Run-AuditStep -Name "4/4 Engine Build      " -ExecCmd "npm" -StepArgs @("run", "build")
    
} else {
    # --- CLIENT INDUSTRIAL Next.js APP AUDIT (6 PHASES) ---
    Write-Host "`n[$appName AUDIT] Starting 6-Phase Industrial Certification..." -ForegroundColor White -BackgroundColor DarkCyan
    
    if (Test-Path $ArchGuardPath) {
        Run-AuditStep -Name "1/6 Structural Audit" -ExecCmd "node" -StepArgs @($ArchGuardPath, "structural")
        Run-AuditStep -Name "2/6 i18n Coverage   " -ExecCmd "node" -StepArgs @($ArchGuardPath, "i18n")
        Run-AuditStep -Name "3/6 a11y Compliance " -ExecCmd "node" -StepArgs @($ArchGuardPath, "a11y")
        Run-AuditStep -Name "4/6 Purity & Types  " -ExecCmd "node" -StepArgs @($ArchGuardPath, "purity")
    } else {
        Write-Host "`nWarning: arch-guard.mjs not found at $ArchGuardPath. Skipping structural audits." -ForegroundColor Yellow
    }
    
    # Type Safety (TSC)
    $tscPath = "node_modules/typescript/lib/tsc.js"
    if (Test-Path $tscPath) {
        Run-AuditStep -Name "5/6 Type Safety (TSC)" -ExecCmd "node" -StepArgs @($tscPath, "--noEmit")
    } else {
        Run-AuditStep -Name "5/6 Type Safety (TSC)" -ExecCmd "npx" -StepArgs @("tsc", "--noEmit")
    }
    
    # Code Quality (ESLint)
    $eslintPath = "node_modules/eslint/bin/eslint.js"
    if (Test-Path $eslintPath) {
        Run-AuditStep -Name "6/6 Code Quality    " -ExecCmd "node" -StepArgs @($eslintPath, "src", "--quiet")
    } else {
        Run-AuditStep -Name "6/6 Code Quality    " -ExecCmd "npx" -StepArgs @("eslint", "src", "--quiet")
    }
}

if ($GlobalStatus) {
    Write-Host "`n[AUDIT] SYSTEM CERTIFIED - ERA 11 COMPLIANT [OK]" -ForegroundColor Green -BackgroundColor Black
    exit 0
} else {
    Write-Host "`n[AUDIT] BREACHES DETECTED - SYSTEM NOT READY [!!]" -ForegroundColor Red -BackgroundColor Black
    Write-Host "Detailed diagnostics available in: $LogFile" -ForegroundColor Gray
    exit 1
}
