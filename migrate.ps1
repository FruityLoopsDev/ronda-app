# Setup Vite + TS script

# 1. Initialize NPM
npm init -y

# 2. Install dependencies
npm install vite typescript --save-dev

# 3. Create tsconfig.json
@"
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
"@ | Out-File -Encoding UTF8 tsconfig.json

# 4. Create vite.config.ts
@"
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5000,
    strictPort: true
  }
})
"@ | Out-File -Encoding UTF8 vite.config.ts

# 5. Move files
if (-not (Test-Path "src")) {
    New-Item -ItemType Directory -Path "src" | Out-Null
}
Move-Item -Path "public/js/*" -Destination "src/" -Force
Move-Item -Path "public/index.html" -Destination "." -Force

# 6. Rename .js to .ts in src
Get-ChildItem -Path "src" -Filter "*.js" | Rename-Item -NewName { $_.Name -replace '\.js$','.ts' }

# 7. Update package.json scripts
$pkg = Get-Content package.json | ConvertFrom-Json
$pkg.scripts | Add-Member -MemberType NoteProperty -Name "dev" -Value "vite"
$pkg.scripts | Add-Member -MemberType NoteProperty -Name "build" -Value "tsc && vite build"
$pkg.scripts | Add-Member -MemberType NoteProperty -Name "preview" -Value "vite preview"
$pkg | ConvertTo-Json -Depth 10 | Set-Content package.json
