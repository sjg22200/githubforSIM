[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function ConvertTo-JsonString([string]$text) {
  if ($null -eq $text) { return "" }
  $builder = New-Object System.Text.StringBuilder
  foreach ($char in $text.ToCharArray()) {
    $code = [int]$char
    switch ($code) {
      92 { [void]$builder.Append("\\") }
      34 { [void]$builder.Append('\"') }
      8 { [void]$builder.Append('\b') }
      12 { [void]$builder.Append('\f') }
      10 { [void]$builder.Append('\n') }
      13 { [void]$builder.Append('\r') }
      9 { [void]$builder.Append('\t') }
      default {
        if ($code -lt 32) { [void]$builder.Append(('\u{0:x4}' -f $code)) }
        else { [void]$builder.Append($char) }
      }
    }
  }
  return $builder.ToString()
}

function Read-DotEnvFile([string]$envFile) {
  $keys = @{}
  if (-not (Test-Path -LiteralPath $envFile)) { return $keys }
  foreach ($line in [IO.File]::ReadAllLines($envFile, [Text.Encoding]::UTF8)) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) { continue }
    $parts = $trimmed.Split("=", 2)
    $keys[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
  }
  return $keys
}

function Read-SimKeys {
  return Read-DotEnvFile (Join-Path (Split-Path $PSScriptRoot -Parent) "practice1022\.env")
}

function Test-SupabasePublishableKey([string]$key) {
  if (-not $key) { return $false }
  if ($key.StartsWith("sb_secret_")) { return $false }
  $parts = $key.Split(".")
  if ($parts.Length -ne 3) { return $true }
  $payload = $parts[1].Replace("-", "+").Replace("_", "/")
  switch ($payload.Length % 4) {
    2 { $payload += "==" }
    3 { $payload += "=" }
  }
  try {
    $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload))
  } catch {
    return $true
  }
  return $json -notmatch '"role"\s*:\s*"service_role"'
}

function Get-SupabasePublicConfig {
  $keys = Read-DotEnvFile (Join-Path $PSScriptRoot ".env")
  $url = [string]$keys["SUPABASE_URL"]
  if (-not $url) { $url = [string]$keys["VITE_SUPABASE_URL"] }
  $publishable = [string]$keys["SUPABASE_PUBLISHABLE_KEY"]
  if (-not $publishable) { $publishable = [string]$keys["VITE_SUPABASE_PUBLISHABLE_KEY"] }
  if (-not $publishable) { $publishable = [string]$keys["SUPABASE_ANON_KEY"] }
  if (-not $url -or -not $publishable) { return @{ ok = $false; error = "missing-config" } }
  if (-not (Test-SupabasePublishableKey $publishable)) { return @{ ok = $false; error = "secret-key-refused" } }
  return @{ ok = $true; url = $url; publishableKey = $publishable }
}

function ConvertTo-Seconds($value) {
  if ($null -eq $value) { return 0.0 }
  if ($value -is [System.Array]) {
    if ($value.Length -lt 1) { return 0.0 }
    $value = $value[0]
  }
  $number = 0.0
  $parsed = [double]::TryParse(([string]$value), [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)
  if (-not $parsed) { return 0.0 }
  return [math]::Round($number, 1)
}

function Get-WebStatusCode($errorRecord) {
  $candidates = @($errorRecord.Exception, $errorRecord.Exception.InnerException)
  foreach ($ex in $candidates) {
    try {
      if ($ex -and $ex.Response) { return [int]$ex.Response.StatusCode }
    } catch {}
  }
  if ([string]$errorRecord.Exception.Message -match '\((\d{3})\)') { return [int]$Matches[1] }
  return 0
}

function Read-ResponseText($response) {
  $stream = $response.RawContentStream
  if ($stream) {
    if ($stream.CanSeek) { $stream.Position = 0 }
    $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::UTF8)
    return $reader.ReadToEnd()
  }
  return [string]$response.Content
}

function ConvertFrom-ModelJson([string]$text) {
  if (-not $text) { throw "model-empty" }
  if ($text.Trim() -eq "[]") { return @() }
  $best = $null
  for ($i = 0; $i -lt $text.Length; $i++) {
    if ($text[$i] -ne '[') { continue }
    $depth = 0
    $inString = $false
    $escape = $false
    for ($j = $i; $j -lt $text.Length; $j++) {
      $ch = $text[$j]
      if ($inString) {
        if ($escape) { $escape = $false }
        elseif ($ch -eq '\') { $escape = $true }
        elseif ($ch -eq '"') { $inString = $false }
        continue
      }
      if ($ch -eq '"') { $inString = $true }
      elseif ($ch -eq '[') { $depth++ }
      elseif ($ch -eq ']') {
        $depth--
        if ($depth -eq 0) {
          $slice = $text.Substring($i, $j - $i + 1)
          try {
            $parsed = $slice | ConvertFrom-Json
            $items = New-Object System.Collections.Generic.List[object]
            foreach ($item in $parsed) {
              $termProp = $item.PSObject.Properties["term"]
              if ($termProp -and $termProp.Value -is [string] -and $termProp.Value.Trim()) { $items.Add($item) }
            }
            if ($items.Count -gt 0 -and ($null -eq $best -or $items.Count -gt $best.Count)) { $best = $items }
          } catch {}
          break
        }
      }
    }
  }
  if (-not $best) { throw "model-failed" }
  return $best
}

function Get-GeminiText($data) {
  $parts = @($data.candidates[0].content.parts)
  $chunks = @()
  foreach ($part in $parts) {
    if ($part.text) { $chunks += [string]$part.text }
  }
  return ($chunks -join "")
}

function Get-GroqText($data) {
  $message = $data.choices[0].message
  if ($null -eq $message) { return "" }
  $content = $message.content
  if ($content -is [string] -and $content.Trim()) { return $content }
  $chunks = @()
  foreach ($part in @($content)) {
    if ($part -is [string]) { $chunks += $part }
    elseif ($part.text) { $chunks += [string]$part.text }
  }
  $joined = $chunks -join ""
  if ($joined.Trim()) { return $joined }
  if ($message.reasoning) { return [string]$message.reasoning }
  return ""
}

function Invoke-GeminiText([string]$apiKey, [string]$prompt) {
  $models = @("gemini-3.5-flash-lite")
  $body = '{"contents":[{"parts":[{"text":"' + (ConvertTo-JsonString $prompt) + '"}]}],"generationConfig":{"temperature":0.1,"maxOutputTokens":8192}}'
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  foreach ($model in $models) {
    try {
      $uri = "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent"
      $response = Invoke-WebRequest -Method POST -Uri $uri -Headers @{ "x-goog-api-key" = $apiKey } -ContentType "application/json; charset=utf-8" -Body $bytes -UseBasicParsing -TimeoutSec 90
      $text = Get-GeminiText ((Read-ResponseText $response) | ConvertFrom-Json)
      if ($text.Trim()) { return $text }
    } catch {
      $code = Get-WebStatusCode $_
      Write-Host ("gemini {0} -> {1}" -f $model, $code)
    }
  }
  throw "model-failed"
}

function Invoke-GroqText([string]$apiKey, [string]$prompt) {
  $models = @("openai/gpt-oss-20b", "openai/gpt-oss-120b")
  foreach ($model in $models) {
    $body = '{"model":"' + $model + '","temperature":0.2,"max_tokens":4096,"reasoning_effort":"low","messages":[{"role":"user","content":"' + (ConvertTo-JsonString $prompt) + '"}]}'
    $bytes = [Text.Encoding]::UTF8.GetBytes($body)
    try {
      $response = Invoke-WebRequest -Method POST -Uri "https://api.groq.com/openai/v1/chat/completions" -Headers @{ Authorization = "Bearer $apiKey" } -ContentType "application/json; charset=utf-8" -Body $bytes -UseBasicParsing -TimeoutSec 90
      $text = Get-GroqText ((Read-ResponseText $response) | ConvertFrom-Json)
      if ($text.Trim()) { return $text }
    } catch {
      $code = Get-WebStatusCode $_
      Write-Host ("groq {0} -> {1}" -f $model, $code)
    }
  }
  throw "model-failed"
}

function Get-CueRows($data) {
  $node = $data
  if ($node.result) { $node = $node.result }
  if ($node.transcript) { $node = $node.transcript }
  $content = $null
  if ($node.content) { $content = $node.content }
  elseif ($data.content) { $content = $data.content }
  $rows = New-Object System.Collections.Generic.List[object]
  if ($content -is [string]) {
    $clock = 0.0
    foreach ($bit in ($content -split '(?<=[.!?])\s+')) {
      $text = $bit.Trim()
      if (-not $text) { continue }
      $rows.Add([pscustomobject]@{ start = $clock; text = $text })
      $clock += 4
    }
    return $rows
  }
  foreach ($chunk in @($content)) {
    if ($null -eq $chunk) { continue }
    $text = ([string]$chunk.text).Trim()
    if (-not $text) { continue }
    $raw = ConvertTo-Seconds ($(if ($null -ne $chunk.offset) { $chunk.offset } else { $chunk.start }))
    $rows.Add([pscustomobject]@{ start = [math]::Round($raw / 1000.0, 1); text = $text })
  }
  return $rows
}

function Select-CueSample($rows, [int]$max) {
  $list = @($rows)
  if ($list.Count -le $max) { return $list }
  $picked = New-Object System.Collections.Generic.List[object]
  $step = ($list.Count - 1) / ($max - 1)
  for ($i = 0; $i -lt $max; $i++) {
    $index = [int][math]::Round($i * $step)
    $picked.Add($list[$index])
  }
  return $picked
}

function Format-CueTranscript($rows) {
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($row in @($rows)) {
    $text = [string]$row.text
    if ($text.Length -gt 320) { $text = $text.Substring(0, 320) }
    $stamp = ([double]$row.start).ToString("0.0", [Globalization.CultureInfo]::InvariantCulture)
    $lines.Add(("[{0}] {1}" -f $stamp, $text))
  }
  return ($lines -join "`n")
}

function ConvertTo-TermJson($terms) {
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($term in $terms) {
    if ($null -eq $term -or -not $term.PSObject.Properties["term"]) { continue }
    $timeText = (ConvertTo-Seconds $term.time).ToString("0.0", [Globalization.CultureInfo]::InvariantCulture)
    $parts.Add(('{{"time":{0},"term":"{1}","quote":"{2}"}}' -f $timeText, (ConvertTo-JsonString ([string]$term.term)), (ConvertTo-JsonString ([string]$term.quote))))
  }
  return "[" + ($parts -join ",") + "]"
}

function Test-UsableTerm($term) {
  $name = ([string]$term.term).Trim()
  if (-not $name) { return $false }
  $words = @($name -split '\s+' | Where-Object { $_ })
  if ($words.Count -lt 1 -or $words.Count -gt 5) { return $false }
  if ($name.Length -gt 48) { return $false }
  return $true
}

function Join-Timeline($terms, $notes) {
  $noteList = @($notes)
  $items = New-Object System.Collections.Generic.List[object]
  $index = 0
  foreach ($term in @($terms)) {
    $name = ([string]$term.term).Trim()
    if (-not $name) { $index++; continue }
    if ($name.Length -gt 80) { $name = $name.Substring(0, 80) }
    $quote = ([string]$term.quote).Trim()
    if ($quote.Length -gt 220) { $quote = $quote.Substring(0, 220) }
    $time = ConvertTo-Seconds $term.time
    $ko = ""
    $explain = ""
    if ($index -lt $noteList.Count -and $noteList[$index]) {
      $note = $noteList[$index]
      $ko = ([string]$note.ko).Trim()
      $explain = ([string]$note.explain).Trim()
      if (-not $explain) { $explain = ([string]$note.explanation).Trim() }
    }
    if ($ko.Length -gt 48) { $ko = $ko.Substring(0, 48) }
    if ($explain.Length -gt 400) { $explain = $explain.Substring(0, 400) }
    $items.Add([pscustomobject]@{
      time = $time
      term = $name
      quote = $quote
      ko = $ko
      explain = $explain
    })
    $index++
  }
  return @($items | Sort-Object time)
}

function Get-SupadataTranscript([string]$apiKey, [string]$videoUrl) {
  $uri = "https://api.supadata.ai/v1/transcript?url=" + [Uri]::EscapeDataString($videoUrl) + "&lang=en&text=false&mode=auto"
  try {
    $response = Invoke-WebRequest -Method GET -Uri $uri -Headers @{ "x-api-key" = $apiKey } -UseBasicParsing -TimeoutSec 120
  } catch {
    $code = Get-WebStatusCode $_
    Write-Host ("supadata -> {0}" -f $code)
    if ($code -eq 401 -or $code -eq 403) { throw "transcript-auth" }
    if ($code -eq 402) { throw "transcript-quota" }
    if ($code -eq 429) { throw "transcript-rate" }
    throw "transcript-failed"
  }
  $data = (Read-ResponseText $response) | ConvertFrom-Json
  $source = "caption"
  if ([int]$response.StatusCode -eq 202 -or $data.jobId) {
    $source = "speech"
    $jobId = [string]$data.jobId
    if (-not $jobId) { throw "transcript-failed" }
    $ready = $false
    for ($i = 0; $i -lt 90; $i++) {
      Start-Sleep -Seconds 2
      try {
        $poll = Invoke-WebRequest -Method GET -Uri ("https://api.supadata.ai/v1/transcript/" + $jobId) -Headers @{ "x-api-key" = $apiKey } -UseBasicParsing -TimeoutSec 30
      } catch {
        $code = Get-WebStatusCode $_
        Write-Host ("supadata poll -> {0}" -f $code)
        throw "transcript-failed"
      }
      $data = (Read-ResponseText $poll) | ConvertFrom-Json
      $status = [string]$data.status
      if ($status -eq "failed") { throw "transcript-failed" }
      if ($status -eq "completed" -or $data.content -or ($data.result -and $data.result.content)) {
        $ready = $true
        break
      }
    }
    if (-not $ready) { throw "transcript-timeout" }
  }
  return @{ source = $source; data = $data }
}

function Get-YtDlp {
  $dir = Join-Path $PSScriptRoot "tools"
  $exe = Join-Path $dir "yt-dlp.exe"
  if (Test-Path -LiteralPath $exe) { return $exe }
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  try {
    Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile $exe -UseBasicParsing -TimeoutSec 120
  } catch {
    Write-Host "yt-dlp download failed"
    return $null
  }
  if (Test-Path -LiteralPath $exe) { return $exe }
  return $null
}

function Get-YouTubeAudio([string]$videoUrl, [string]$videoId) {
  $exe = Get-YtDlp
  if (-not $exe) { return $null }
  $folder = Join-Path $env:TEMP "sim-audio"
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  Get-ChildItem -LiteralPath $folder -Filter ("sim-" + $videoId + ".*") -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  $pattern = Join-Path $folder ("sim-" + $videoId + ".%(ext)s")
  try {
    & $exe -f "ba[filesize<20M]/wa[filesize<20M]/worstaudio" --no-playlist --max-filesize 20M --no-warnings --no-progress -o $pattern $videoUrl 2>&1 | Out-Null
  } catch {
    Write-Host "whisper audio unavailable"
  }
  $file = Get-ChildItem -LiteralPath $folder -Filter ("sim-" + $videoId + ".*") -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -ne ".part" -and $_.Length -gt 1000 -and $_.Length -lt 24MB } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $file) { return $null }
  return $file.FullName
}

function Remove-YouTubeAudio([string]$path) {
  if ($path -and (Test-Path -LiteralPath $path)) {
    Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
  }
}

function Invoke-GroqWhisper([string]$apiKey, [string]$audioPath) {
  $boundary = [guid]::NewGuid().ToString("N")
  $stream = New-Object System.IO.MemoryStream
  $prompt = "Live football commentary, word for word. Free kick, corner kick, offside, through ball, high press, one-two, nutmeg, near post, far post, goalkeeper, cross, header, shot, save, penalty, VAR, counter-attack, set piece, clean sheet, handball."
  foreach ($pair in @(
    @("model", "whisper-large-v3"),
    @("language", "en"),
    @("temperature", "0"),
    @("response_format", "verbose_json"),
    @("timestamp_granularities[]", "segment"),
    @("prompt", $prompt)
  )) {
    $chunk = "--$boundary`r`nContent-Disposition: form-data; name=`"$($pair[0])`"`r`n`r`n$($pair[1])`r`n"
    $buf = [Text.Encoding]::UTF8.GetBytes($chunk)
    $stream.Write($buf, 0, $buf.Length)
  }
  $ext = [IO.Path]::GetExtension($audioPath).ToLowerInvariant()
  $mime = "application/octet-stream"
  if ($ext -eq ".m4a" -or $ext -eq ".mp4") { $mime = "audio/mp4" }
  elseif ($ext -eq ".mp3") { $mime = "audio/mpeg" }
  elseif ($ext -eq ".webm") { $mime = "audio/webm" }
  elseif ($ext -eq ".wav") { $mime = "audio/wav" }
  elseif ($ext -eq ".ogg" -or $ext -eq ".opus") { $mime = "audio/ogg" }
  $header = "--$boundary`r`nContent-Disposition: form-data; name=`"file`"; filename=`"audio$ext`"`r`nContent-Type: $mime`r`n`r`n"
  $headerBytes = [Text.Encoding]::UTF8.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $fileBytes = [IO.File]::ReadAllBytes($audioPath)
  $stream.Write($fileBytes, 0, $fileBytes.Length)
  $tail = [Text.Encoding]::UTF8.GetBytes("`r`n--$boundary--`r`n")
  $stream.Write($tail, 0, $tail.Length)
  $body = $stream.ToArray()
  $stream.Dispose()
  $response = Invoke-WebRequest -Method POST -Uri "https://api.groq.com/openai/v1/audio/transcriptions" -Headers @{ Authorization = "Bearer $apiKey" } -ContentType "multipart/form-data; boundary=$boundary" -Body $body -UseBasicParsing -TimeoutSec 180
  return (Read-ResponseText $response) | ConvertFrom-Json
}

function Get-WhisperRows($data) {
  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($segment in @($data.segments)) {
    if ($null -eq $segment) { continue }
    $text = ([string]$segment.text).Trim()
    if (-not $text) { continue }
    if ($text -match '^\[(music|applause|laughter)\]$') { continue }
    $rows.Add([pscustomobject]@{ start = (ConvertTo-Seconds $segment.start); text = $text })
  }
  return $rows
}

function Get-WhisperTranscript([string]$apiKey, [string]$videoUrl, [string]$videoId) {
  $audio = Get-YouTubeAudio $videoUrl $videoId
  if (-not $audio) { return $null }
  try {
    $data = Invoke-GroqWhisper $apiKey $audio
    $rows = @(Get-WhisperRows $data)
    if (-not $rows.Count) { return $null }
    return @{ source = "speech"; rows = $rows }
  } catch {
    $code = Get-WebStatusCode $_
    Write-Host ("groq whisper -> {0}" -f $code)
    return $null
  } finally {
    Remove-YouTubeAudio $audio
  }
}

function Normalize-TermName([string]$name) {
  if (-not $name) { return "" }
  $clean = $name.ToLowerInvariant() -replace '[^a-z0-9]+', ' '
  return $clean.Trim()
}

function Get-KnownSet($names) {
  $set = @{}
  foreach ($name in @($names)) {
    $norm = Normalize-TermName ([string]$name)
    if ($norm.Length -ge 3) { $set[$norm] = $true }
  }
  return $set
}

function Test-KnownTerm([string]$name, $knownSet) {
  $norm = Normalize-TermName $name
  if (-not $norm) { return $false }
  return [bool]$knownSet.ContainsKey($norm)
}

function Split-CueWindows($rows, [int]$size) {
  $list = @($rows)
  $windows = New-Object System.Collections.Generic.List[object]
  for ($offset = 0; $offset -lt $list.Count; $offset += $size) {
    $slice = New-Object System.Collections.Generic.List[object]
    $end = [Math]::Min($offset + $size, $list.Count)
    for ($i = $offset; $i -lt $end; $i++) { $slice.Add($list[$i]) }
    $windows.Add($slice)
  }
  return $windows
}

function Limit-Text([string]$text, [int]$max) {
  $clean = ([string]$text).Trim()
  if ($clean.Length -gt $max) { return $clean.Substring(0, $max) }
  return $clean
}

function ConvertTo-DictionaryEntry($term, $note) {
  $ko = ""
  $say = ""
  $cat = "slang"
  $blurb = ""
  $body = ""
  $usage = ""
  $exampleKo = ""
  if ($note) {
    $ko = Limit-Text $note.ko 48
    $say = Limit-Text $note.say 40
    $picked = ([string]$note.cat).Trim().ToLowerInvariant()
    $allowed = @("law", "tactic", "attack", "defense", "setpiece", "keeper", "player", "slang")
    if ($allowed -contains $picked) { $cat = $picked }
    $blurb = Limit-Text $(if ($note.blurb) { $note.blurb } else { $note.explain }) 220
    $body = Limit-Text $note.body 520
    $usage = Limit-Text $note.usage 240
    $exampleKo = Limit-Text $note.exampleKo 220
  }
  return [pscustomobject]@{
    time = [double]$term.time
    term = [string]$term.term
    quote = [string]$term.quote
    ko = $ko
    explain = $blurb
    say = $say
    cat = $cat
    blurb = $blurb
    body = $body
    usage = $usage
    exampleKo = $exampleKo
  }
}

function Get-NovelTerms($rows, $knownSet, [string]$apiKey) {
  $found = New-Object System.Collections.Generic.List[object]
  $seen = @{}
  $knownText = ((@($knownSet.Keys) | Select-Object -First 400) -join ", ")
  $stop = $false
  foreach ($window in @(Split-CueWindows $rows 48)) {
    if ($stop) { break }
    $script = Format-CueTranscript $window
    $prompt = "You read one slice of an English football broadcast. Each line starts with seconds, like [12.4].`n" +
      "Return only a JSON array. No markdown. If nothing qualifies, return [].`n" +
      "Extract every dictionary-worthy sports term, idiom, and commentator phrase in this slice: tactics, set pieces, actions, and stock phrases such as high press, low cross, defensive header, danger man, leaves him for dust.`n" +
      "Skip KNOWN terms, player names, club names, scores, and ordinary narrative.`n" +
      "Each object: {""time"": number, ""term"": ""1 to 5 consecutive words copied from that line"", ""quote"": ""the line's words only, copied exactly, without the [time] marker""}.`n" +
      "The term must be consecutive words inside that line. Do not paraphrase or translate.`n`n" +
      "KNOWN`n" + $knownText + "`n`nTRANSCRIPT`n" + $script
    try {
      $parsed = @(ConvertFrom-ModelJson (Invoke-GeminiText $apiKey $prompt))
    } catch {
      Write-Host "gemini slice failed"
      continue
    }
    foreach ($term in @($parsed)) {
      if (-not (Test-UsableTerm $term)) { continue }
      if (Test-KnownTerm ([string]$term.term) $knownSet) { continue }
      $fixed = Resolve-TermCue $term $rows
      if (-not $fixed) { continue }
      $norm = Normalize-TermName $fixed.term
      $bucket = [string][int]([math]::Floor(([double]$fixed.time) / 20))
      $key = $norm + "|" + $bucket
      if ($seen.ContainsKey($key)) { continue }
      $seen[$key] = $true
      $found.Add($fixed)
      if ($found.Count -ge 80) { $stop = $true; break }
    }
  }
  return @($found | Sort-Object time)
}

function Complete-NovelTerms($terms, [string]$apiKey) {
  $list = New-Object System.Collections.Generic.List[object]
  foreach ($term in $terms) {
    if ($term -and $term.PSObject.Properties["term"]) { $list.Add($term) }
  }
  $done = New-Object System.Collections.Generic.List[object]
  $step = 8
  for ($offset = 0; $offset -lt $list.Count; $offset += $step) {
    $batch = New-Object System.Collections.Generic.List[object]
    $end = [Math]::Min($offset + $step, $list.Count)
    for ($i = $offset; $i -lt $end; $i++) { $batch.Add($list[$i]) }
    $prompt = "You write Korean dictionary entries for football commentary English.`n" +
      "Return only a JSON array of the same length and order. No markdown.`n" +
      "Keep term exactly. Add ko (2 to 8 Korean words), say (a short pronunciation hint), cat (one of law, tactic, attack, defense, setpiece, keeper, player, slang), blurb (one Korean sentence), body (two Korean sentences), usage (one Korean sentence about when a commentator says it), exampleKo (a Korean rendering of the given quote).`n" +
      "Do not change the English term and do not invent a new English example.`n`nINPUT`n" + (ConvertTo-TermJson $batch)
    $notes = New-Object System.Collections.Generic.List[object]
    try {
      foreach ($note in (ConvertTo-ModelList (ConvertFrom-ModelJson (Invoke-GeminiText $apiKey $prompt)))) { $notes.Add($note) }
    } catch {
      Write-Host "gemini explain batch failed"
    }
    for ($i = 0; $i -lt $batch.Count; $i++) {
      $note = $null
      if ($i -lt $notes.Count) { $note = $notes[$i] }
      $done.Add((ConvertTo-DictionaryEntry $batch[$i] $note))
    }
  }
  $copy = New-Object object[] $done.Count
  if ($done.Count -gt 0) { $done.CopyTo($copy, 0) }
  Write-Output -NoEnumerate $copy
}

function Get-BroadcastTimeline([string]$VideoUrl, $Known) {
  $keys = Read-SimKeys
  if (-not $keys["supadata_api_key"] -or -not $keys["gemini_api_key"] -or -not $keys["groq_api_key"]) {
    throw "no-keys"
  }
  $url = [string]$VideoUrl
  if (-not $url) { throw "missing-url" }
  if ($url -notmatch 'youtu\.be/|youtube\.com/') { throw "bad-url" }
  $videoId = ""
  if ($url -match 'youtu\.be/([A-Za-z0-9_-]+)') { $videoId = $Matches[1] }
  elseif ($url -match '[?&]v=([A-Za-z0-9_-]+)') { $videoId = $Matches[1] }

  $source = ""
  $allRows = @()
  $whisper = Get-WhisperTranscript $keys["groq_api_key"] $url $videoId
  if ($whisper) {
    $source = "speech"
    $allRows = @($whisper.rows)
  } else {
    $transcript = Get-SupadataTranscript $keys["supadata_api_key"] $url
    $source = [string]$transcript.source
    $allRows = @(Get-CueRows $transcript.data)
  }
  if (-not $allRows.Count) { throw "transcript-empty" }

  $items = @()
  try {
    $novel = @(Get-NovelTerms $allRows (Get-KnownSet $Known) $keys["gemini_api_key"])
    if ($novel.Count) {
      $packed = New-Object System.Collections.Generic.List[object]
      foreach ($term in $novel) { $packed.Add($term) }
      $items = Complete-NovelTerms -terms $packed -apiKey $keys["gemini_api_key"]
    }
  } catch {
    Write-Host "gemini timeline failed"
    $items = @()
  }

  return @{
    source = $source
    videoId = $videoId
    title = (Get-YouTubeTitle $url)
    items = @($items)
    cues = @($allRows | Select-Object -First 1500)
  }
}

function Resolve-TermCue($term, $rows) {
  $name = ([string]$term.term).Trim()
  if (-not $name) { return $null }
  $target = ConvertTo-Seconds $term.time
  $pattern = '(?i)(?<![A-Za-z0-9])' + [regex]::Escape($name) + '(?![A-Za-z0-9])'
  $best = $null
  $bestGap = [double]::MaxValue
  foreach ($row in @($rows)) {
    if ([string]$row.text -notmatch $pattern) { continue }
    $gap = [math]::Abs(([double]$row.start) - $target)
    if ($gap -lt $bestGap) {
      $bestGap = $gap
      $best = $row
    }
  }
  if (-not $best) { return $null }
  $quote = ([string]$best.text).Trim()
  if ($quote.Length -gt 280) { $quote = $quote.Substring(0, 280) }
  return [pscustomobject]@{
    time = [double]$best.start
    term = $name
    quote = $quote
    ko = ([string]$term.ko).Trim()
    explain = ([string]$term.explain).Trim()
  }
}

function ConvertTo-ModelList($value) {
  $list = New-Object System.Collections.Generic.List[object]
  if ($null -eq $value) { return $list }
  if ($value -is [System.Array]) {
    foreach ($item in $value) {
      if ($item -and $item.PSObject.Properties["term"]) { $list.Add($item) }
    }
  } elseif ($value.PSObject.Properties["term"]) {
    $list.Add($value)
  }
  return $list
}

function Get-QuoteTranslations($lines) {
  $keys = Read-SimKeys
  if (-not $keys["gemini_api_key"]) { throw "no-keys" }
  $source = New-Object System.Collections.Generic.List[string]
  if ($lines -is [string]) {
    $source.Add($lines)
  } elseif ($null -ne $lines) {
    foreach ($line in $lines) { $source.Add([string]$line) }
  }
  $result = New-Object System.Collections.Generic.List[string]
  $step = 8
  for ($offset = 0; $offset -lt $source.Count; $offset += $step) {
    $batch = New-Object System.Collections.Generic.List[string]
    $end = [Math]::Min($offset + $step, $source.Count)
    for ($i = $offset; $i -lt $end; $i++) {
      $text = $source[$i].Trim()
      if ($text.Length -gt 280) { $text = $text.Substring(0, 280) }
      $batch.Add($text)
    }
    $numbered = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $batch.Count; $i++) { $numbered.Add(("{0}. {1}" -f ($i + 1), $batch[$i])) }
    $prompt = "Translate each English football commentary line into natural Korean.`n" +
      "Keep the action the same: a win stays a win, and a goal stays a goal.`n" +
      "Keep player names, team names, stadium names, and other proper nouns in their original English spelling.`n" +
      "Return only a JSON array of the same length and order. No markdown.`n" +
      "Each object: {""term"": ""the Korean translation of that one line""}.`n`nLINES`n" + ($numbered -join "`n")
    $notes = New-Object System.Collections.Generic.List[object]
    try {
      $raw = Invoke-GeminiText $keys["gemini_api_key"] $prompt
      foreach ($note in (ConvertTo-ModelList (ConvertFrom-ModelJson $raw))) { $notes.Add($note) }
    } catch {
      Write-Host "gemini translate batch failed"
    }
    for ($i = 0; $i -lt $batch.Count; $i++) {
      $ko = ""
      if ($i -lt $notes.Count -and $notes[$i].term) { $ko = ([string]$notes[$i].term).Trim() }
      if ($ko.Length -gt 320) { $ko = $ko.Substring(0, 320) }
      $result.Add($ko)
    }
  }
  $copy = @()
  foreach ($item in $result) { $copy += [string]$item }
  ,$copy
}

function Get-YouTubeTitle([string]$videoUrl) {
  try {
    $uri = "https://www.youtube.com/oembed?format=json&url=" + [Uri]::EscapeDataString($videoUrl)
    $response = Invoke-WebRequest -Method GET -Uri $uri -Headers @{ "User-Agent" = "Mozilla/5.0" } -UseBasicParsing -TimeoutSec 20
    $data = (Read-ResponseText $response) | ConvertFrom-Json
    $title = ([string]$data.title).Trim()
    if ($title.Length -gt 80) { $title = $title.Substring(0, 80) }
    return $title
  } catch {
    return ""
  }
}

function Write-SimJson($context, [int]$status, $payload) {
  $json = $null
  if ($payload -is [hashtable] -and $payload.ContainsKey("cues")) {
    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($item in @($payload.items)) {
      $time = 0.0
      if ($null -ne $item.time) { $time = [double]$item.time }
      $timeText = $time.ToString("0.0", [Globalization.CultureInfo]::InvariantCulture)
      $parts.Add(('{{"time":{0},"term":"{1}","quote":"{2}","ko":"{3}","explain":"{4}","say":"{5}","cat":"{6}","blurb":"{7}","body":"{8}","usage":"{9}","exampleKo":"{10}"}}' -f $timeText, (ConvertTo-JsonString ([string]$item.term)), (ConvertTo-JsonString ([string]$item.quote)), (ConvertTo-JsonString ([string]$item.ko)), (ConvertTo-JsonString ([string]$item.explain)), (ConvertTo-JsonString ([string]$item.say)), (ConvertTo-JsonString ([string]$item.cat)), (ConvertTo-JsonString ([string]$item.blurb)), (ConvertTo-JsonString ([string]$item.body)), (ConvertTo-JsonString ([string]$item.usage)), (ConvertTo-JsonString ([string]$item.exampleKo))))
    }
    $cueParts = New-Object System.Collections.Generic.List[string]
    foreach ($cue in @($payload.cues)) {
      $cueTime = 0.0
      if ($null -ne $cue.start) { $cueTime = [double]$cue.start }
      $cueText = $cueTime.ToString("0.0", [Globalization.CultureInfo]::InvariantCulture)
      $cueParts.Add(('{{"start":{0},"text":"{1}"}}' -f $cueText, (ConvertTo-JsonString ([string]$cue.text))))
    }
    $json = '{"source":"' + (ConvertTo-JsonString ([string]$payload.source)) + '","videoId":"' + (ConvertTo-JsonString ([string]$payload.videoId)) + '","title":"' + (ConvertTo-JsonString ([string]$payload.title)) + '","items":[' + ($parts -join ",") + '],"cues":[' + ($cueParts -join ",") + ']}'
  } else {
    $json = $payload | ConvertTo-Json -Depth 6 -Compress
  }
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $context.Response.StatusCode = $status
  $context.Response.ContentType = "application/json; charset=utf-8"
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
}
