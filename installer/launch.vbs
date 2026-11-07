Option Explicit
Dim shell, fso, installDir, runtime, launcher, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
installDir = fso.GetParentFolderName(WScript.ScriptFullName)
runtime = fso.BuildPath(installDir, "node\node.exe")
launcher = fso.BuildPath(installDir, "launcher.mjs")
If Not fso.FileExists(runtime) Or Not fso.FileExists(launcher) Then
  MsgBox "AutoQuotes Free is incomplete. Please reinstall the application.", vbExclamation, "AutoQuotes Free"
  WScript.Quit 1
End If
command = """" & runtime & """ """ & launcher & """"
shell.Run command, 0, False
