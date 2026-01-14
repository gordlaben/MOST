# Usage: ./scripts/release_to_main.ps1

$ErrorActionPreference = "Stop"

# --- CONFIGURATION ---
$IMAGE_NAME = "gordlaben/most"
# ---------------------

function Check-Command {
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ Previous command failed. Aborting sequence."
        exit 1
    }
}

Write-Host "Starting Local Enterprise Release..." -ForegroundColor Cyan

# 0. Docker Check
docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker is not running. Please start Docker Desktop."
    exit 1
}

# 1. Pre-flight Checks
$currentBranch = git branch --show-current
if ($currentBranch.Trim() -ne "dev") {
    Write-Error "You must be on the 'dev' branch to release."
}

$status = git status --porcelain
if ($status) {
    Write-Error "You have uncommitted changes. Commit or stash them first."
}

# 2. Sync Branches (Ensure everything is fresh)
Write-Host "Pulling latest dev..." -ForegroundColor Yellow
git pull origin dev
Check-Command

# --- AUTO VERSION BUMP ---
Write-Host "Auto-incrementing version (Patch)..." -ForegroundColor Cyan
npm version patch --no-git-tag-version
Check-Command

$packageJson = Get-Content "package.json" | ConvertFrom-Json
$newVersion = $packageJson.version

# Stage and commit the version bump on dev
git add package.json package-lock.json
# Suppress error if package-lock.json hasn't changed or doesn't exist in git yet
git commit -m "chore: bump version to $newVersion"
Check-Command
# -------------------------

Write-Host "Syncing main branch..." -ForegroundColor Yellow
git checkout main
Check-Command
git pull origin main
Check-Command

# 3. Generate Changelog (Now that Main is up to date)
# We compare main..dev to see what is NEW in dev
$commits = git log main..dev --oneline --no-merges
if (-not $commits) {
    Write-Warning "No new changes to merge from dev to main."
    Write-Host "Returning to dev..."
    git checkout dev
    exit
}

$today = Get-Date -Format "yyyy-MM-dd"
$mergeMessage = "Release $today`n`n$commits"

Write-Host "Detected changes found." -ForegroundColor Gray

# 4. Merge Dev into Main
Write-Host "Merging dev into main..." -ForegroundColor Yellow
git merge dev --no-ff -m "$mergeMessage"
Check-Command

# 5. Docker Build (LOCALLY)
Write-Host "Building Docker Image..." -ForegroundColor Cyan
# Get version from package.json (on main, so it includes any version bumps from dev)
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version

Write-Host "   Version: $version" -ForegroundColor Gray

# Tags: latest, version number
docker build -t "$($IMAGE_NAME):latest" -t "$($IMAGE_NAME):$($version)" .
Check-Command

# 6. Docker Push
Write-Host "Pushing Images to Registry..." -ForegroundColor Cyan
docker push "$($IMAGE_NAME):latest"
Check-Command
docker push "$($IMAGE_NAME):$($version)"
Check-Command

# 7. Git Push
Write-Host "Pushing Code to GitHub..." -ForegroundColor Green
git push origin main
Check-Command

# 8. Return Home
Write-Host "Returning to dev branch..." -ForegroundColor Yellow
git checkout dev
Check-Command

Write-Host "Release Complete! Code is on Main, Image is in Registry." -ForegroundColor Green
