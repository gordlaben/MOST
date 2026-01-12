# Stop on error
$ErrorActionPreference = "Stop"

# Helper Function to Prompt
function Get-UserChoice {
    param([string]$prompt, [string[]]$choices)
    do {
        $input = Read-Host "$prompt ($($choices -join '/'))"
    } while ($choices -notcontains $input)
    return $input
}

# Ensure we are in the project root
Set-Location (Join-Path $PSScriptRoot "..")

# 1. Check Branch
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
    Write-Host "Error: You must be on the 'main' branch to run this script. Please merge 'dev' into 'main' first." -ForegroundColor Red
    exit 1
}

# 2. Read Current Version
$packageJsonPath = Join-Path $PSScriptRoot "..\package.json"
$content = Get-Content $packageJsonPath -Raw
$json = $content | ConvertFrom-Json
$currentVersion = $json.version

Write-Host "[INFO] Starting MAIN (Production) Deployment" -ForegroundColor Cyan
Write-Host "Current Version: $currentVersion"

# 3. Determine Bump Type
$bumpType = Get-UserChoice "Select bump type" @("patch", "minor", "major", "cancel")

if ($bumpType -eq "cancel") { exit 0 }

$parts = $currentVersion.Split('.')
$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

switch ($bumpType) {
    "patch" { $patch++ }
    "minor" { $minor++; $patch = 0 }
    "major" { $major++; $minor = 0; $patch = 0 }
}

$newVersion = "$major.$minor.$patch"
Write-Host "[WARN] Bumping version to: $newVersion" -ForegroundColor Yellow

# 4. Generate Changelog
$changelogPath = Join-Path $PSScriptRoot "..\CHANGELOG.md"
if (-not (Test-Path $changelogPath)) { New-Item $changelogPath -ItemType File }

# Safely get last tag, or fallback to first commit
try {
    $lastTag = git describe --tags --abbrev=0 2>$null
    if ($LASTEXITCODE -ne 0) { throw "No tags found" }
} catch {
    $lastTag = git rev-list --max-parents=0 HEAD
}

$commits = git log "$lastTag..HEAD" --pretty=format:"- %s"
$date = Get-Date -Format "yyyy-MM-dd"
$changelogEntry = "## [$newVersion] - $date`n$commits`n`n"
$currentChangelog = Get-Content $changelogPath -Raw
Set-Content $changelogPath "$changelogEntry$currentChangelog"

# 5. Update package.json
$json.version = $newVersion
$newContent = $json | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($packageJsonPath, $newContent)

# 6. Build & Push Docker (Before commit to fail early if build fails)
Write-Host "[INFO] Building Docker images..." -ForegroundColor Yellow
docker build -t gordlaben/most:latest -t "gordlaben/most:$newVersion" .

Write-Host "[INFO] Pushing Docker images..." -ForegroundColor Yellow
docker push gordlaben/most:latest
docker push "gordlaben/most:$newVersion"

# 7. Git Commit & Tag
Write-Host "[INFO] Committing and Tagging..." -ForegroundColor Yellow
git add package.json CHANGELOG.md
git commit -m "chore: release v$newVersion"
git tag "v$newVersion"
git push origin main
git push origin "v$newVersion"

Write-Host "[SUCCESS] MAIN Deployment Complete!" -ForegroundColor Green
Write-Host "   - Version bumped to $newVersion"
Write-Host "   - Changelog updated"
Write-Host "   - Docker tag: gordlaben/most:latest"
Write-Host "   - Docker tag: gordlaben/most:$newVersion"
