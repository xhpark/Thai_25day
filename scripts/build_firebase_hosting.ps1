$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "dist\firebase-hosting"
$resolvedRoot = [System.IO.Path]::GetFullPath($root)
$resolvedDist = [System.IO.Path]::GetFullPath($dist)

if (-not $resolvedDist.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to clean a directory outside the project: $resolvedDist"
}

if (Test-Path $resolvedDist) {
  Remove-Item -LiteralPath $resolvedDist -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $resolvedDist | Out-Null

$rootFiles = @(
  "index.html",
  "app.js",
  "styles.css",
  "service-worker.js",
  "manifest.webmanifest"
)

foreach ($file in $rootFiles) {
  Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $resolvedDist $file)
}

Copy-Item -LiteralPath (Join-Path $root "assets") -Destination (Join-Path $resolvedDist "assets") -Recurse
Copy-Item -LiteralPath (Join-Path $root "voice-pilot") -Destination (Join-Path $resolvedDist "voice-pilot") -Recurse

Write-Host "Firebase Hosting bundle created: $resolvedDist"
