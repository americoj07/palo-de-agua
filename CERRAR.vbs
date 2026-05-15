Set oShell = CreateObject("WScript.Shell")

' ── Matar todos los procesos Node.js silenciosamente ───────────────
oShell.Run "cmd /c taskkill /f /im node.exe", 0, True

' ── Pequeña pausa ───────────────────────────────────────────────────
WScript.Sleep 1000

' ── Detener MySQL en Ubuntu (WSL) ───────────────────────────────────
oShell.Run "cmd /c wsl -u siragon sudo service mysql stop", 0, True

' ── Confirmar al usuario ────────────────────────────────────────────
MsgBox "✅ Palo de Agua cerrado correctamente." & vbCrLf & vbCrLf & _
       "El servidor, el frontend y MySQL se detuvieron.", _
       vbInformation, "PALO DE AGUA - Sistema POS"