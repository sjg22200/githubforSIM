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

function Read-SimKeys {
  $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) "practice1022\.env"
  $keys = @{}
  if (-not (Test-Path -LiteralPath $envFile)) { return $keys }
  foreach ($line in [IO.File]::ReadAllLines($envFile, [Text.Encoding]::UTF8)) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) { continue }
    $parts = $trimmed.Split("=", 2)
    $keys[$parts[0].Trim()] = $parts[1].Trim()
  }
  return $keys
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
  $found = $null
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
            $parsed = @($slice | ConvertFrom-Json)
            if ($parsed.Count -gt 0 -and $parsed[0].term) { $found = $parsed }
          } catch {}
          break
        }
      }
    }
  }
  if (-not $found) { throw "model-failed" }
  return @($found)
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
  $body = '{"contents":[{"parts":[{"text":"' + (ConvertTo-JsonString $prompt) + '"}]}],"generationConfig":{"temperature":0.2,"maxOutputTokens":4096}}'
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
    if ($text.Length -gt 180) { $text = $text.Substring(0, 180) }
    $stamp = ([double]$row.start).ToString("0.0", [Globalization.CultureInfo]::InvariantCulture)
    $lines.Add(("[{0}] {1}" -f $stamp, $text))
  }
  return ($lines -join "`n")
}

function ConvertTo-TermJson($terms) {
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($term in @($terms)) {
    $time = ConvertTo-Seconds $term.time
    $timeText = $time.ToString("0.0", [Globalization.CultureInfo]::InvariantCulture)
    $parts.Add(('{{"time":{0},"term":"{1}","quote":"{2}"}}' -f $timeText, (ConvertTo-JsonString ([string]$term.term)), (ConvertTo-JsonString ([string]$term.quote))))
  }
  return "[" + ($parts -join ",") + "]"
}

function Test-UsableTerm($term) {
  $name = ([string]$term.term).Trim()
  if (-not $name) { return $false }
  $words = @($name -split '\s+' | Where-Object { $_ })
  if ($words.Count -lt 1 -or $words.Count -gt 6) { return $false }
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

function Get-BroadcastTimeline([string]$VideoUrl) {
  $keys = Read-SimKeys
  if (-not $keys["supadata_api_key"] -or -not $keys["gemini_api_key"] -or -not $keys["groq_api_key"]) {
    throw "no-keys"
  }
  $url = [string]$VideoUrl
  if (-not $url) { throw "missing-url" }
  if ($url -notmatch 'youtu\.be/|youtube\.com/') { throw "bad-url" }

  $transcript = Get-SupadataTranscript $keys["supadata_api_key"] $url
  $allRows = @(Get-CueRows $transcript.data)
  if (-not $allRows.Count) { throw "transcript-empty" }
  $rows = @(Select-CueSample $allRows 24)
  $script = Format-CueTranscript $rows

  $extractPrompt = "You extract association-football commentary terms for learners.`n" +
    "Each line starts with seconds, like [12.4].`n" +
    "Return only a JSON array. No markdown.`n" +
    "Each object: {""time"": number, ""term"": ""1 to 4 words"", ""quote"": ""that one line""}.`n" +
    "Good terms: starting lineup, free kick, corner, cross, header, shot, high press, through ball.`n" +
    "Do not paste a whole caption into term. Use only lines from this transcript.`n`nTRANSCRIPT`n" + $script

  $terms = @()
  try {
    $extracted = Invoke-GroqText $keys["groq_api_key"] $extractPrompt
    $terms = @(ConvertFrom-ModelJson $extracted | Where-Object { Test-UsableTerm $_ } | Select-Object -First 20)
  } catch {
    Write-Host "groq extract failed"
    $terms = @()
  }
  if (-not $terms.Count) {
    try {
      $extracted = Invoke-GeminiText $keys["gemini_api_key"] $extractPrompt
      $terms = @(ConvertFrom-ModelJson $extracted | Where-Object { Test-UsableTerm $_ } | Select-Object -First 20)
    } catch {
      Write-Host "gemini extract failed"
      $terms = @()
    }
  }
  $items = @()
  if ($terms.Count) {
    $explainPromptTemplate = @"
You write a concise Korean dictionary for football commentary English.
Return only a JSON array of the same length and order. No markdown.
Keep time, term, and quote. Add "ko" (a Korean gloss of 2 to 8 words) and "explain" (one or two Korean sentences about when a commentator says it).
The first character must be [ and the last character must be ].

INPUT
{0}
"@
    $packed = ConvertTo-TermJson $terms
    $explainPrompt = $explainPromptTemplate -f $packed
    try {
      $notes = @(ConvertFrom-ModelJson (Invoke-GeminiText $keys["gemini_api_key"] $explainPrompt))
    } catch {
      Write-Host "gemini explain failed, groq will explain"
      $notes = @(ConvertFrom-ModelJson (Invoke-GroqText $keys["groq_api_key"] $explainPrompt))
    }
    $anchored = New-Object System.Collections.Generic.List[object]
    foreach ($item in @(Join-Timeline $terms $notes)) {
      $fixed = Resolve-TermCue $item $allRows
      if ($fixed) { $anchored.Add($fixed) }
    }
    $items = @($anchored)
  }

  $videoId = ""
  if ($url -match 'youtu\.be/([A-Za-z0-9_-]+)') { $videoId = $Matches[1] }
  elseif ($url -match '[?&]v=([A-Za-z0-9_-]+)') { $videoId = $Matches[1] }
  return @{
    source = $transcript.source
    videoId = $videoId
    title = (Get-YouTubeTitle $url)
    items = @($items)
    cues = @($allRows | Select-Object -First 800)
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
      $parts.Add(('{{"time":{0},"term":"{1}","quote":"{2}","ko":"{3}","explain":"{4}"}}' -f $timeText, (ConvertTo-JsonString ([string]$item.term)), (ConvertTo-JsonString ([string]$item.quote)), (ConvertTo-JsonString ([string]$item.ko)), (ConvertTo-JsonString ([string]$item.explain))))
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
