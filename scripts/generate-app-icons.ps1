param([string]$OutputDirectory = "public/icons")

Add-Type -AssemblyName System.Drawing
[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

foreach ($size in @(180, 192, 512)) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#047857'))

  $scale = $size / 512.0
  $leaf = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $leaf.AddBezier(116 * $scale, 328 * $scale, 190 * $scale, 319 * $scale, 248 * $scale, 280 * $scale, 290 * $scale, 202 * $scale)
  $leaf.AddBezier(290 * $scale, 202 * $scale, 321 * $scale, 237 * $scale, 332 * $scale, 283 * $scale, 313 * $scale, 324 * $scale)
  $leaf.AddBezier(313 * $scale, 324 * $scale, 286 * $scale, 384 * $scale, 212 * $scale, 412 * $scale, 116 * $scale, 394 * $scale)
  $leaf.CloseFigure()
  $graphics.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#D1FAE5')), $leaf)

  $stem = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 30 * $scale)
  $stem.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $stem.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $curve = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(164 * $scale, 357 * $scale),
    [System.Drawing.PointF]::new(232 * $scale, 249 * $scale),
    [System.Drawing.PointF]::new(302 * $scale, 209 * $scale),
    [System.Drawing.PointF]::new(394 * $scale, 188 * $scale)
  )
  $graphics.DrawCurve($stem, $curve)
  $graphics.FillEllipse([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#FBBF24')), 330 * $scale, 102 * $scale, 80 * $scale, 80 * $scale)

  $filename = if ($size -eq 180) { 'apple-touch-icon.png' } else { "fertcalc-$size.png" }
  $bitmap.Save((Join-Path $OutputDirectory $filename), [System.Drawing.Imaging.ImageFormat]::Png)
  $leaf.Dispose()
  $stem.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
