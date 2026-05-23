$tablesFile = "C:\Users\Micro\.gemini\antigravity-ide\brain\f117aae6-6c79-4a34-8311-2941e8b678a6\.system_generated\steps\25\output.txt"
$tablesJson = Get-Content -Raw -Path $tablesFile | ConvertFrom-Json
$pedidosTable = $tablesJson.tables | Where-Object { $_.name -eq "public.pedidos_venda" }

Write-Host "Tabela: $($pedidosTable.name)"
Write-Host "Colunas:"
foreach ($col in $pedidosTable.columns) {
    Write-Host " - $($col.name) ($($col.data_type))"
}

Write-Host "`nChaves Estrangeiras:"
foreach ($fk in $pedidosTable.foreign_key_constraints) {
    Write-Host " - $($fk.name): $($fk.source) -> $($fk.target)"
}
