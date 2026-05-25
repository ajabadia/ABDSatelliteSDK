# ABD Suite - CENTRAL AUDIT DELEGATOR
# Checks the local suite utilidades directory first, falling back to node_modules/@abd/styles.

$SuiteCentralScript = "D:\desarrollos\ABDSuite\utilidades\scripts\abd-audit.ps1"
$StylesCentralScript = "$PSScriptRoot/../node_modules/@abd/styles/scripts/abd-audit.ps1"

if (Test-Path $SuiteCentralScript) {
    & powershell -File $SuiteCentralScript
    exit $LASTEXITCODE
} elseif (Test-Path $StylesCentralScript) {
    & powershell -File $StylesCentralScript
    exit $LASTEXITCODE
} else {
    Write-Host "`nError: Central audit script not found in ABD Suite or node_modules." -ForegroundColor Red
    Write-Host "Please restore dependencies or verify your local development structure.`n" -ForegroundColor Yellow
    exit 1
}
