$root = $PSScriptRoot
$port = 8787
$addresses = [System.Collections.Generic.List[string]]::new()
$addresses.Add("localhost")
try {
  Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254*" } |
    ForEach-Object { [void]$addresses.Add($_.IPAddress) }
} catch {}

function Start-SimListener($bindAddresses) {
  $listener = [System.Net.HttpListener]::new()
  foreach ($address in $bindAddresses) {
    $listener.Prefixes.Add("http://${address}:${port}/")
  }
  $listener.Start()
  return $listener
}

try {
  $listener = Start-SimListener $addresses
} catch {
  try {
    $listener = Start-SimListener @("localhost")
    $addresses = @("localhost")
  } catch {
    Write-Host "8787 포트를 열 수 없습니다. 이미 SIM이 실행 중이면 브라우저에서 http://localhost:8787/ 를 여세요."
    exit 1
  }
}

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".webmanifest" = "application/manifest+json"
  ".json" = "application/json; charset=utf-8"
  ".woff2" = "font/woff2"
  ".ttf" = "font/ttf"
}

. (Join-Path $PSScriptRoot "api.ps1")

Write-Host "SIM을 켰습니다. 끝내려면 이 창에서 Ctrl+C"
foreach ($address in $addresses) {
  Write-Host ("  http://{0}:{1}/" -f $address, $port)
}
Write-Host "휴대폰은 같은 와이파이에서 위 주소 중 localhost가 아닌 주소로 여세요."
Start-Process "http://localhost:$port/"

while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $path = $context.Request.Url.AbsolutePath
    if ($context.Request.HttpMethod -eq "GET" -and $path -eq "/api/supabase-config") {
      $config = Get-SupabasePublicConfig
      if ($config.ok) {
        Write-SimJson $context 200 @{ url = [string]$config.url; publishableKey = [string]$config.publishableKey }
      } else {
        Write-SimJson $context 503 @{ error = [string]$config.error }
      }
    } elseif ($context.Request.HttpMethod -eq "POST" -and $path -eq "/api/translate") {
      try {
        $reader = New-Object System.IO.StreamReader($context.Request.InputStream, [Text.Encoding]::UTF8)
        $rawBody = $reader.ReadToEnd()
        $reader.Dispose()
        $incoming = $null
        if ($rawBody) { $incoming = $rawBody | ConvertFrom-Json }
        $lines = @()
        if ($incoming) { $lines = $incoming.lines }
        $translated = Get-QuoteTranslations $lines
        $parts = New-Object System.Collections.Generic.List[string]
        foreach ($line in $translated) { $parts.Add('"' + (ConvertTo-JsonString ([string]$line)) + '"') }
        $json = '{"lines":[' + ($parts -join ",") + ']}'
        $bytes = [Text.Encoding]::UTF8.GetBytes($json)
        $context.Response.StatusCode = 200
        $context.Response.ContentType = "application/json; charset=utf-8"
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } catch {
        Write-SimJson $context 400 @{ error = "model-failed" }
      }
    } elseif ($context.Request.HttpMethod -eq "POST" -and $path -eq "/api/broadcast") {
      try {
        $reader = New-Object System.IO.StreamReader($context.Request.InputStream, [Text.Encoding]::UTF8)
        $rawBody = $reader.ReadToEnd()
        $reader.Dispose()
        $incoming = $null
        if ($rawBody) { $incoming = $rawBody | ConvertFrom-Json }
        $videoUrl = ""
        $known = @()
        if ($incoming) {
          $videoUrl = [string]$incoming.url
          if ($incoming.known) { $known = @($incoming.known) }
        }
        $result = Get-BroadcastTimeline -VideoUrl $videoUrl -Known $known
        Write-SimJson $context 200 $result
      } catch {
        $code = ([string]$_.Exception.Message).Trim()
        $known = @("missing-url","bad-url","no-keys","transcript-auth","transcript-quota","transcript-rate","transcript-empty","transcript-timeout","transcript-failed","model-failed","model-empty")
        if ($known -notcontains $code) {
          $short = $code
          if ($short.Length -gt 160) { $short = $short.Substring(0, 160) }
          Write-Host ("broadcast error: " + $short)
          $code = "model-failed"
        }
        Write-SimJson $context 400 @{ error = $code }
      }
    } else {
      $relative = [Uri]::UnescapeDataString($path)
      if ([string]::IsNullOrWhiteSpace($relative) -or $relative -eq "/") { $relative = "/index.html" }
      $relative = $relative.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
      $file = [IO.Path]::GetFullPath((Join-Path $root $relative))
      if ($file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($file)
        $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
        $context.Response.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" })
        $context.Response.Headers["Cache-Control"] = "no-cache"
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $context.Response.StatusCode = 404
        $missing = [Text.Encoding]::UTF8.GetBytes("Not found")
        $context.Response.OutputStream.Write($missing, 0, $missing.Length)
      }
    }
  } catch {
    try { $context.Response.StatusCode = 500 } catch {}
  } finally {
    try { $context.Response.Close() } catch {}
  }
}
