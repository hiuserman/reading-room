$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $authJson = terraform output -json auth_frontend
    if ($LASTEXITCODE -ne 0) { throw 'Terraform auth_frontend output failed.' }
    $healthUrl = terraform output -raw health_url
    if ($LASTEXITCODE -ne 0) { throw 'Terraform health_url output failed.' }
    $auth = $authJson | ConvertFrom-Json
    if (-not $auth.authority -or -not $auth.client_id -or -not $auth.domain) {
        throw 'Apply the Cognito configuration before exporting.'
    }
    $target = Join-Path $PSScriptRoot '../../frontend/.env.production'
    $lines = @(
        ('NEXT_PUBLIC_API_BASE_URL=' + ($healthUrl -replace '/api/health$', '')),
        ('NEXT_PUBLIC_COGNITO_AUTHORITY=' + $auth.authority),
        ('NEXT_PUBLIC_COGNITO_CLIENT_ID=' + $auth.client_id),
        ('NEXT_PUBLIC_COGNITO_DOMAIN=' + $auth.domain)
    )
    [System.IO.File]::WriteAllLines([System.IO.Path]::GetFullPath($target), $lines, [System.Text.UTF8Encoding]::new($false))
    Write-Output 'Updated frontend/.env.production (public configuration only).'
} finally { Pop-Location }
