# AutoQuotes Free — Windows 11 development

The Windows edition is **in development**. Automated installation, server, PDF and uninstall checks run on a Windows Server GitHub Actions runner; the installer has not yet been validated on a Windows 11 desktop. The existing Linux edition remains available separately.

AutoQuotes Free runs a local Node.js server and opens in your browser. The Windows installer is being prepared for 64-bit Windows 11 and is intended to include Node.js and the Playwright Chromium build required for PDFs and parts features. It provides a Start menu shortcut and an optional desktop shortcut.

## Prerequisites for development

- A Windows 11 x64 computer, a browser, Git, and PowerShell.
- [Node.js](https://nodejs.org/en/download) 20 or newer; Node.js 22 is recommended for this project. The developer setup uses npm from the Node installation.
- Internet access for npm dependencies and Playwright Chromium. Parts searches require internet access; LM Studio is optional.
- If the `better-sqlite3` native module cannot install a prebuilt binary for your Node version, its [Windows troubleshooting guide](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md) describes the native build tools it may need.

Use a Windows checkout of the Windows-development work. Do not copy `node_modules` from a Linux installation: the SQLite native module and Chromium must be installed for Windows.

## Run from source

From PowerShell in the checkout directory, run:

```powershell
.\scripts\setup-windows.cmd
.\scripts\launch-windows.cmd
```

The setup script runs `npm ci`, downloads Playwright Chromium, and builds the application. It does not erase or reinitialize an existing database. The launcher starts the server and opens `http://127.0.0.1:3000`; it stops with an error if another process is using that port. The production server is intended to stop after the browser tab closes, with a grace period for refreshes.

For development, `npm run dev` starts the backend and Vite; open `http://localhost:5173`. Run `npm test` for the automated tests and `npm run build` to rebuild. `npm run start:keep` leaves the production server running until stopped with Ctrl+C.

### Source-run data location

By default, source runs store the database in `data\autoquote.db`, PDFs in `exports\`, and uploaded logos in `uploads\` under the checkout. To keep those files outside the checkout, set the environment variable **before** starting the app, for example:

```powershell
$env:AUTOQUOTES_DATA_DIR = Join-Path $env:LOCALAPPDATA 'AutoQuotes Free Development'
npm run start:keep
```

The app creates `data`, `exports`, and `uploads` under that directory. If you use a separate directory for testing, your normal checkout data is unaffected.

## Planned installer

The installer is configured for a per-user installation under `%LOCALAPPDATA%\Programs\AutoQuotes Free`, without requiring an administrator. Its launcher sets `AUTOQUOTES_DATA_DIR` to `%LOCALAPPDATA%\AutoQuotes Free`, outside the installed program directory. Customer records and uploaded/exported files are intended to remain there across updates and uninstallation; verify this behavior on Windows before relying on the installer.

To build the experimental installer on Windows, install [Inno Setup 6](https://jrsoftware.org/isinfo.php), make sure the Node distribution's `LICENSE` file is beside `node.exe`, then build the application first:

```powershell
npm ci
npm run build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\build-windows.ps1
```

The build script stages the compiled app and public vehicle catalog, installs production dependencies for Windows, downloads Playwright Chromium into the bundle, and invokes the Inno Setup compiler. It does not stage the local database, quote PDFs, or uploaded logos. Its default output directory is `windows-output\`. The build requires network access and may need the native build tools noted above. Successful GitHub Actions runs retain an unsigned test installer and SHA-256 checksum for seven days. The installer still needs Windows 11 desktop validation and third-party notice review before release.

## Optional LM Studio

Install [LM Studio for Windows](https://lmstudio.ai/download), download and load an instruction model, then start the local server in LM Studio's Developer tab. In AutoQuotes Free, enable AI in Settings and enter the API base URL, normally `http://localhost:1234/v1`; test the connection and save. The main README describes model options and setup in more detail. AI is optional and is not used to calculate prices.

## Privacy and backups

The app has no login and is intended for one user on one computer. Keep the server on loopback; do not expose it to a network. Stop the app cleanly before backing up its database and preserve the `data`, `exports`, and `uploads` folders in a protected location. SMTP credentials and local records are not encrypted by the app. RockAuto parts features and email communicate with external services; AI requests go to the configured endpoint.

Before releasing the installer, test the desktop shortcut, quote-to-billing, local AI, upgrades, and uninstallation on a clean Windows 11 machine, including preservation of user data. The automated checks do not replace that desktop test.
