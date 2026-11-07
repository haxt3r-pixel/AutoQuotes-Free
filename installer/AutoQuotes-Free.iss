#ifndef StageDir
  #error StageDir must point to the clean Windows staging directory.
#endif
#ifndef OutputDir
  #define OutputDir "."
#endif
#define AppVersion "1.0.0"

[Setup]
AppId={{54E3E918-7174-4B63-A0AA-2BF23FF26013}
AppName=AutoQuotes Free
AppVersion={#AppVersion}
AppVerName=AutoQuotes Free {#AppVersion} for Windows
DefaultDirName={localappdata}\Programs\AutoQuotes Free
DefaultGroupName=AutoQuotes Free
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#OutputDir}
OutputBaseFilename=AutoQuotes-Free-Windows-1.0.0-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
LicenseFile={#StageDir}\app\LICENSE

[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Files]
Source: "{#StageDir}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\launch.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\message.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\launcher.mjs"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\browser-install.mjs"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\browser-setup.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\AutoQuotes Free"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; WorkingDir: "{app}"
Name: "{autodesktop}\AutoQuotes Free"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; Description: "Launch AutoQuotes Free"; Flags: nowait postinstall skipifsilent
