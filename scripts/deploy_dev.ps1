# Stop script on first error
$ErrorActionPreference = "Stop"

# Check Branch
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "dev") {
    Write-Host "Error: You must be on the 'dev' branch to run this script. Current branch: $branch" -ForegroundColor Red
    exit 1
}

# Read Version
$packageJsonPath = Join-Path $PSScriptRoot "..\package.json"
$content = Get-Content $packageJsonPath -Raw
$json = $content | ConvertFrom-Json
$version = $json.version
$devTag = "$version-dev"

Write-Host "[INFO] Starting DEV Deployment for version $version..." -ForegroundColor Cyan

# Docker Build & Push
Write-Host "[INFO] Building Docker images..." -ForegroundColor Yellow
docker build -t gordlaben/most:dev -t "gordlaben/most:$devTag" .

Write-Host "[INFO] Pushing Docker images..." -ForegroundColor Yellow
docker push gordlaben/most:dev
docker push "gordlaben/most:$devTag"

# Git Push
Write-Host "[INFO] Pushing code to origin/dev..." -ForegroundColor Yellow
git push origin dev

Write-Host "[SUCCESS] DEV Deployment Complete!" -ForegroundColor Green
Write-Host "   - Code pushed to dev branch"
Write-Host "   - Docker tag: gordlaben/most:dev"
Write-Host "   - Docker tag: gordlaben/most:$devTag"
