Option Explicit
Dim shell, result
Set shell = CreateObject("WScript.Shell")
result = shell.Popup("AutoQuotes Free is downloading the browser required for PDFs and parts search. This can take several minutes and requires internet access. The app will open automatically when setup is complete.", 15, "AutoQuotes Free setup", 64)
