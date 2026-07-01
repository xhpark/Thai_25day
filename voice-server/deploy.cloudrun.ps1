param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = "asia-northeast3",
  [string]$ServiceName = "thai25-voice-server",
  [string]$EnvFile = ".\env.cloudrun.yaml",
  [int]$MinInstances = 0
)

$ErrorActionPreference = "Stop"

$gcloud = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloud) {
  throw "gcloud CLI is not installed or not on PATH. Install Google Cloud CLI before deploying."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir = Resolve-Path $scriptDir
$envPath = Resolve-Path -Path (Join-Path $scriptDir $EnvFile) -ErrorAction SilentlyContinue
if (-not $envPath) {
  throw "Missing Cloud Run env file: $EnvFile. Copy env.cloudrun.example.yaml to env.cloudrun.yaml and fill real values."
}

$envText = Get-Content -Raw $envPath
if ($envText -match "REPLACE_WITH_") {
  throw "The Cloud Run env file still contains REPLACE_WITH placeholders."
}

Write-Host "Deploying $ServiceName to project=$ProjectId region=$Region from $sourceDir"
Write-Host "Cloud Run will be public, but app access is enforced by Firebase UID allowlist + WebAuthn session token."

gcloud run deploy $ServiceName `
  --project $ProjectId `
  --region $Region `
  --source $sourceDir `
  --allow-unauthenticated `
  --env-vars-file $envPath `
  --min-instances $MinInstances `
  --memory 512Mi `
  --cpu 1 `
  --timeout 300 `
  --concurrency 80

Write-Host ""
Write-Host "After deploy, copy the Cloud Run service URL into voice-pilot/config.js:"
Write-Host "  stt.apiBaseUrl = https://SERVICE_URL"
Write-Host "  stt.websocketUrl = wss://SERVICE_URL/ws/stt"
