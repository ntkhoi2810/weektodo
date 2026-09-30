param()

# Generate PNG, ICO, and ICNS assets from the repository SVG.
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$source = Join-Path $root 'weektodo-icon-mono.svg'
[xml]$svg = Get-Content -LiteralPath $source -Raw
$view = @($svg.svg.viewBox.Split(' ') | ForEach-Object { [double]::Parse($_, [Globalization.CultureInfo]::InvariantCulture) })

function New-RoundedRectangle([single]$x, [single]$y, [single]$width, [single]$height, [single]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = 2 * $radius
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc(($x + $width - $diameter), $y, $diameter, $diameter, 270, 90)
  $path.AddArc(($x + $width - $diameter), ($y + $height - $diameter), $diameter, $diameter, 0, 90)
  $path.AddArc($x, ($y + $height - $diameter), $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-IconPng([int]$size, [string]$destination, [switch]$light) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $scale = [Math]::Min($size / $view[2], $size / $view[3])
    $left = ($size - $view[2] * $scale) / 2
    $top = ($size - $view[3] * $scale) / 2

    $background = $svg.svg.rect
    $x = [single]($left + ([double]$background.x - $view[0]) * $scale)
    $y = [single]($top + ([double]$background.y - $view[1]) * $scale)
    $w = [single]([double]$background.width * $scale)
    $h = [single]([double]$background.height * $scale)
    $r = [single]([double]$background.rx * $scale)
    $tile = New-RoundedRectangle $x $y $w $h $r
    $tileColor = if ($light) { '#14161A' } else { $background.fill }
    $strokeColor = if ($light) { '#565A60' } else { $background.stroke }
    $fill = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($tileColor))
    $stroke = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($strokeColor), [single]([double]$background.'stroke-width' * $scale))
    try {
      $graphics.FillPath($fill, $tile)
      $graphics.DrawPath($stroke, $tile)
    } finally {
      $stroke.Dispose()
      $fill.Dispose()
      $tile.Dispose()
    }

    $barColor = [System.Drawing.ColorTranslator]::FromHtml($(if ($light) { '#FFFFFF' } else { $svg.svg.g.fill }))
    foreach ($bar in $svg.svg.g.rect) {
      $x = [single]($left + ([double]$bar.x - $view[0]) * $scale)
      $y = [single]($top + ([double]$bar.y - $view[1]) * $scale)
      $w = [single]([double]$bar.width * $scale)
      $h = [single]([double]$bar.height * $scale)
      $r = [single]([double]$bar.rx * $scale)
      $opacity = if ($bar.'fill-opacity') { [double]::Parse($bar.'fill-opacity', [Globalization.CultureInfo]::InvariantCulture) } else { 1.0 }
      $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb([int][Math]::Round(255 * $opacity), $barColor))
      $shape = New-RoundedRectangle $x $y $w $h $r
      try { $graphics.FillPath($brush, $shape) } finally { $shape.Dispose(); $brush.Dispose() }
    }

    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function New-Ico([int[]]$sizes, [string]$destination, [switch]$light) {
  $images = foreach ($size in $sizes) {
    $temporary = Join-Path $env:TEMP ("weektodo-icon-$size-$([guid]::NewGuid()).png")
    New-IconPng $size $temporary -Light:$light
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
    New-IconPng $types[$type] $temporary
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

Copy-Item -LiteralPath $source -Destination (Join-Path $root 'public/weektodo-icon-mono.svg') -Force
New-IconPng 512 (Join-Path $root 'build/weektodo-icon-mono.png')
New-IconPng 512 (Join-Path $root 'public/weektodo-icon-mono.png')
New-IconPng 180 (Join-Path $root 'public/apple-touch-icon.png')
New-IconPng 16 (Join-Path $root 'public/tray-icon.png')
New-IconPng 48 (Join-Path $root 'public/tray-icon@3x.png')
New-IconPng 16 (Join-Path $root 'public/tray-icon-light.png') -Light
New-IconPng 48 (Join-Path $root 'public/tray-icon-light@3x.png') -Light
New-Ico @(16, 24, 32, 48, 64, 128, 256) (Join-Path $root 'build/weektodo-icon-mono.ico')
New-Ico @(16, 32, 48) (Join-Path $root 'public/favicon.ico')
New-Ico @(16, 32) (Join-Path $root 'public/tray-icon.ico')
New-Ico @(16, 32) (Join-Path $root 'public/tray-icon-light.ico') -Light
New-Icns (Join-Path $root 'build/weektodo-icon-mono.icns')
