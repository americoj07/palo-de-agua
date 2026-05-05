Set oShell = CreateObject("WScript.Shell")

' ── Matar todos los procesos Node.js silenciosamente ───────────────
oShell.Run "cmd /c taskkill /f /im node.exe", 0, True

' ── Pequeña pausa para asegurar que todo se cerró ──────────────────
WScript.Sleep 1000

' ── Confirmar al usuario ────────────────────────────────────────────
MsgBox "✅ Palo de Agua cerrado correctamente." & vbCrLf & vbCrLf & _
       "El servidor y el frontend se detuvieron.", _
       vbInformation, "PALO DE AGUA - Sistema POS"
