# Stop script on first error
$ErrorActionPreference = "Stop"

# Read package.json
$packageJsonPath = Join-Path $PSScriptRoot "package.json"
$content = Get-Content $packageJsonPath -Raw
$json = $content | ConvertFrom-Json

# Parse version
$version = $json.version
$parts = $version.Split('.')
$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

# Increment logic
$patch++

if ($patch -ge 10) {
    $patch = 0
    $minor++
}

if ($minor -ge 10) {
    $minor = 0
    $major++
}

$newVersion = "$major.$minor.$patch"
Write-Host "Bumping version from $version to $newVersion"

# Update package.json
$json.version = $newVersion
$newContent = $json | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($packageJsonPath, $newContent)

# Commit the version bump
Write-Host "Committing version bump..."
git add package.json
git commit -m "chore: bump version to $newVersion [skip ci]"
git push

# Build the Docker image with latest tag only
Write-Host "Building Docker image..."
docker build -t gordlaben/most:latest .

# Push the image to Docker Hub
Write-Host "Pushing Docker image..."
docker push gordlaben/most:latest

Write-Host "Build and push completed successfully! Version: $newVersion"
