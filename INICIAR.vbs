Set oShell = CreateObject("WScript.Shell")
Set oFSO   = CreateObject("Scripting.FileSystemObject")

' ── Ruta base: carpeta donde está este archivo .vbs ─────────────────
Dim basePath, backendPath, frontendPath
basePath     = oFSO.GetParentFolderName(WScript.ScriptFullName)
backendPath  = basePath & "\backend"
frontendPath = basePath & "\frontend"

' ── Arrancar MySQL en Ubuntu (WSL) ──────────────────────────────────
oShell.Run "cmd /c wsl -u siragon sudo service mysql start", 0, True

' ── Esperar 3 segundos para que MySQL levante ───────────────────────
WScript.Sleep 3000

' ── Arrancar servidor (backend) en segundo plano ────────────────────
oShell.Run "cmd /c cd /d """ & backendPath & """ && node server.js", 0, False

' ── Esperar 3 segundos para que el servidor levante ─────────────────
WScript.Sleep 3000

' ── Arrancar frontend con --host para acceso desde red local ────────
oShell.Run "cmd /c cd /d """ & frontendPath & """ && npm run dev -- --host", 0, False

' ── Esperar 8 segundos para que Vite compile ────────────────────────
WScript.Sleep 8000

' ── Abrir el navegador ──────────────────────────────────────────────
oShell.Run "http://localhost:5173", 1, False