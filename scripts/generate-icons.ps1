param()

# Generate the raster formats required by Electron and operating systems from
# the single SVG supplied at the repository root.
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$source = Join-Path $root 'icon-mono.svg'
[xml]$svg = Get-Content -LiteralPath $source -Raw
$view = @($svg.svg.viewBox.Split(' ') | ForEach-Object { [double]::Parse($_, [Globalization.CultureInfo]::InvariantCulture) })
$bars = @($svg.svg.g.rect)

function New-IconPng([int]$size, [string]$color, [string]$destination) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $scale = [Math]::Min($size * 0.88 / $view[2], $size * 0.88 / $view[3])
  $left = ($size - $view[2] * $scale) / 2
  $top = ($size - $view[3] * $scale) / 2
  $rgb = [System.Drawing.ColorTranslator]::FromHtml($color)

  foreach ($bar in $bars) {
    $x = [single]($left + ([double]$bar.x - $view[0]) * $scale)
    $y = [single]($top + ([double]$bar.y - $view[1]) * $scale)
    $w = [single]([double]$bar.width * $scale)
    $h = [single]([double]$bar.height * $scale)
    $r = [single]([double]$bar.rx * $scale)
    $opacity = if ($bar.'fill-opacity') { [double]::Parse($bar.'fill-opacity', [Globalization.CultureInfo]::InvariantCulture) } else { 1.0 }
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb([int][Math]::Round(255 * $opacity), $rgb))
    $graphics.FillRectangle($brush, $x, ($y + $r), $w, ($h - 2 * $r))
    $graphics.FillEllipse($brush, $x, $y, $w, (2 * $r))
    $graphics.FillEllipse($brush, $x, ($y + $h - 2 * $r), $w, (2 * $r))
    $brush.Dispose()
  }

  $directory = Split-Path $destination -Parent
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function New-Ico([int[]]$sizes, [string]$color, [string]$destination) {
  $images = foreach ($size in $sizes) {
    $temporary = Join-Path $env:TEMP ("weektodo-icon-$size-$([guid]::NewGuid()).png")
    New-IconPng $size $color $temporary
    try { ,([System.IO.File]::ReadAllBytes($temporary)) } finally { Remove-Item -LiteralPath $temporary }
  }
  $stream = [System.IO.File]::Create($destination)
  $writer = New-Object System.IO.BinaryWriter($stream)
  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
      $writer.Write([byte]($sizes[$i] % 256))
      $writer.Write([byte]($sizes[$i] % 256))
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$images[$i].Length)
      $writer.Write([uint32]$offset)
      $offset += $images[$i].Length
    }
    foreach ($image in $images) { $writer.Write([byte[]]$image) }
  } finally { $writer.Dispose() }
}

function Write-BigEndianInt([System.IO.BinaryWriter]$writer, [int]$value) {
  $bytes = [BitConverter]::GetBytes([uint32]$value)
  [Array]::Reverse($bytes)
  $writer.Write([byte[]]$bytes)
}

function New-Icns([string]$destination) {
  $types = [ordered]@{ icp4 = 16; icp5 = 32; icp6 = 64; ic07 = 128; ic08 = 256; ic09 = 512; ic10 = 1024 }
  $images = [ordered]@{}
  foreach ($type in $types.Keys) {
    $temporary = Join-Path $env:TEMP ("weektodo-icon-$type-$([guid]::NewGuid()).png")
    New-IconPng $types[$type] '#000000' $temporary
    try { $images[$type] = [System.IO.File]::ReadAllBytes($temporary) } finally { Remove-Item -LiteralPath $temporary }
  }
  $total = 8
  foreach ($image in $images.Values) { $total += 8 + $image.Length }
  $stream = [System.IO.File]::Create($destination)
  $writer = New-Object System.IO.BinaryWriter($stream)
  try {
    $writer.Write([Text.Encoding]::ASCII.GetBytes('icns'))
    Write-BigEndianInt $writer $total
    foreach ($type in $types.Keys) {
      $writer.Write([Text.Encoding]::ASCII.GetBytes($type))
      Write-BigEndianInt $writer (8 + $images[$type].Length)
      $writer.Write([byte[]]$images[$type])
    }
  } finally { $writer.Dispose() }
}

Copy-Item -LiteralPath $source -Destination (Join-Path $root 'public/icon-mono.svg') -Force
New-IconPng 512 '#000000' (Join-Path $root 'build/icon-mono.png')
New-IconPng 512 '#000000' (Join-Path $root 'public/icon-mono.png')
New-IconPng 180 '#000000' (Join-Path $root 'public/apple-touch-icon.png')
New-IconPng 16 '#000000' (Join-Path $root 'public/tray-icon.png')
New-IconPng 48 '#000000' (Join-Path $root 'public/tray-icon@3x.png')
New-IconPng 16 '#ffffff' (Join-Path $root 'public/tray-icon-light.png')
New-IconPng 48 '#ffffff' (Join-Path $root 'public/tray-icon-light@3x.png')
New-Ico @(16, 24, 32, 48, 64, 128, 256) '#000000' (Join-Path $root 'build/icon-mono.ico')
New-Ico @(16, 32, 48) '#000000' (Join-Path $root 'public/favicon.ico')
New-Ico @(16, 32) '#000000' (Join-Path $root 'public/tray-icon.ico')
New-Ico @(16, 32) '#ffffff' (Join-Path $root 'public/tray-icon-light.ico')
New-Icns (Join-Path $root 'build/icon-mono.icns')
