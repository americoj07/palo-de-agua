Set oShell = CreateObject("WScript.Shell")
Set oFSO   = CreateObject("Scripting.FileSystemObject")

' ── Ruta base: carpeta donde está este archivo .vbs ─────────────────
Dim basePath, backendPath, frontendPath
basePath     = oFSO.GetParentFolderName(WScript.ScriptFullName)
backendPath  = basePath & "\backend"
frontendPath = basePath & "\frontend"

' ── MySQL ya corre como servicio de Windows automáticamente ─────────
' ── (no necesita arranque manual, no necesita WSL) ──────────────────

' ── Arrancar servidor Node (backend) ────────────────────────────────
oShell.Run "cmd /c cd /d """ & backendPath & """ && node server.js", 0, False

' ── Esperar que el servidor levante ─────────────────────────────────
WScript.Sleep 4000

' ── Arrancar frontend Vite ───────────────────────────────────────────
oShell.Run "cmd /c cd /d """ & frontendPath & """ && npm run dev -- --host", 0, False

' ── Esperar que Vite compile ─────────────────────────────────────────
WScript.Sleep 8000

' ── Abrir navegador ──────────────────────────────────────────────────
oShell.Run "http://localhost:5173", 1, False