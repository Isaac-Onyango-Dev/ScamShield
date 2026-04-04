# ScamShield Development Server Starter for Windows PowerShell
# Usage: .\rundev.ps1

$env:NODE_ENV = "development"
$env:PORT = "5000"

Write-Host "🚀 Starting ScamShield Development Server..."
Write-Host "📍 Environment: $env:NODE_ENV"
Write-Host "🔌 Port: $env:PORT"
Write-Host ""

# Run the development server using tsx
& npx tsx server/index.ts

# If npx doesn't work, try this:
# & node_modules\.bin\tsx server/index.ts
