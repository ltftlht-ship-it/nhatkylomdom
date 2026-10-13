Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\IVL\Documents\antigravity\calm-borg\BIG-deal"

Dim fso, tempFile
Set fso = CreateObject("Scripting.FileSystemObject")
tempFile = fso.GetSpecialFolder(2) & "\check_port_3000.txt"
WshShell.Run "cmd /c netstat -ano | findstr :3000 > """ & tempFile & """", 0, True

Dim fileContent
fileContent = ""
If fso.FileExists(tempFile) Then
    On Error Resume Next
    Dim ts
    Set ts = fso.OpenTextFile(tempFile, 1)
    fileContent = ts.ReadAll
    ts.Close
    fso.DeleteFile tempFile
    On Error GoTo 0
End If

If InStr(fileContent, "LISTENING") = 0 Then
    WshShell.Run "cmd /c npm.cmd run dev", 0, False
End If
