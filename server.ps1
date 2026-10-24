# server.ps1 - Servidor HTTP TCP multi-dispositivo para Delarosa Nail Designer
$port = 8080
$baseDir = $PSScriptRoot

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)

try {
    $listener.Start()
    Write-Output "Servidor multi-dispositivo activo en puerto ${port}:"
    Write-Output "  En Computador:       http://localhost:${port}/"
    Write-Output "  En iPhone / Android: http://192.168.1.80:${port}/"
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".ics"  = "text/calendar; charset=utf-8"
}

while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $writer = New-Object System.IO.BinaryWriter($stream)

        $requestLine = $reader.ReadLine()
        if (-not $requestLine) {
            $client.Close()
            continue
        }

        # Formato: GET /index.html HTTP/1.1
        $parts = $requestLine.Split(" ")
        $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { "/" }
        
        # Quitar parámetros query si existen (?v=...)
        $cleanPath = $rawPath.Split("?")[0]
        if ($cleanPath -eq "/" -or [string]::IsNullOrWhiteSpace($cleanPath)) {
            $cleanPath = "/index.html"
        }

        $decodedPath = [System.Uri]::UnescapeDataString($cleanPath)
        $filePath = [System.IO.Path]::Combine($baseDir, $decodedPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar))

        if ([System.IO.File]::Exists($filePath)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)

            $header = "HTTP/1.1 200 OK`r`n" +
                      "Content-Type: $contentType`r`n" +
                      "Content-Length: $($bytes.Length)`r`n" +
                      "Cache-Control: no-cache, no-store, must-revalidate`r`n" +
                      "Access-Control-Allow-Origin: *`r`n" +
                      "Connection: close`r`n`r`n"

            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
            $writer.Write($headerBytes)
            $writer.Write($bytes)
            $writer.Flush()
        } else {
            $body = [System.Text.Encoding]::UTF8.GetBytes("404 No Encontrado")
            $header = "HTTP/1.1 404 Not Found`r`n" +
                      "Content-Type: text/plain; charset=utf-8`r`n" +
                      "Content-Length: $($body.Length)`r`n" +
                      "Connection: close`r`n`r`n"

            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
            $writer.Write($headerBytes)
            $writer.Write($body)
            $writer.Flush()
        }

        $client.Close()
    } catch {
        # Continuar aceptando peticiones
    }
}
