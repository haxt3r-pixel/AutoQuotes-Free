# AutoQuotes Free — Windows 11 Edition

**Version 1.0.0 · Windows x64 · beta**

AutoQuotes Free creates repair quotes, tracks approved mechanic jobs, and records whether a completed job was paid. It runs a local server and opens in your web browser. The optional LM Studio connection can help polish notes, explain parts, and suggest priorities; the pricing calculations do not use AI.

A previous Windows installer passed automated installation, startup, PDF generation, shortcut-creation, and uninstall data-preservation checks on a Windows Server runner. The revised first-launch browser download must also be verified. **The app has not yet been tested on a Windows 11 desktop.** Treat this as a test version and back up your records. The installer is unsigned, so Windows SmartScreen may show a warning.

## Requirements

- A Windows 11 PC with a 64-bit x64 processor and a modern browser, such as Microsoft Edge, Chrome, or Firefox.
- Enough free disk space for the application, its first-launch Chromium download, and your data. Chromium requires additional disk space beyond the installer.
- Internet access to download the installer and Chromium on first launch. RockAuto parts data, LM Studio, and AI models also require downloads or network access when used.
- Optional: [LM Studio for Windows](https://lmstudio.ai/download) and a compatible model. Check [LM Studio's system requirements](https://lmstudio.ai/docs/app/system-requirements) before installing it.

The installer includes Node.js; it downloads the compatible Playwright Chromium browser into your user profile on first launch. You do **not** need to install Node.js, Git, or Python to use the installed application. It installs for the current Windows user without requiring an administrator under normal circumstances. AI and RockAuto features are optional for manual quote entry.

## Install the Windows beta

1. Open the [Windows 1.0.0 beta release](https://github.com/haxt3r-pixel/AutoQuotes-Free/releases/tag/windows-v1.0.0-beta). Under **Assets**, download `AutoQuotes-Free-Windows-1.0.0-Setup.exe` and its `.sha256` checksum file.
2. Optionally verify the download in PowerShell from the folder containing both files:

   ```powershell
   Get-FileHash .\AutoQuotes-Free-Windows-1.0.0-Setup.exe -Algorithm SHA256
   Get-Content .\AutoQuotes-Free-Windows-1.0.0-Setup.exe.sha256
   ```

   Confirm the hash values match before running the installer. A checksum checks file integrity; it does not provide a publisher signature.
3. Run the installer, review the license and destination, and follow the prompts. Select **Create a desktop shortcut** if you want one. Windows may warn that the installer is unsigned; assess the warning before deciding whether to run it.
4. Choose **Launch AutoQuotes Free** at the end of setup, or open **AutoQuotes Free** from the Start menu or desktop shortcut. On first launch, a console window shows progress while the compatible Chromium browser is downloaded; stay online and allow several minutes. Your default browser should then open `http://127.0.0.1:3000`. If the download fails or times out, the app will not start; check your connection and launch it again to retry.
5. On first launch the application creates a new empty database and a generic shop profile. Set up your shop and rates before creating quotes.

The default program location is `%LOCALAPPDATA%\Programs\AutoQuotes Free`. Chromium is stored under `%LOCALAPPDATA%\AutoQuotes Free\browsers`; subsequent launches can work offline as long as the matching browser files remain available. The desktop shortcut is optional; the Start menu shortcut is created by the installer. The server is designed to stop after the application tab closes, with a short grace period for refreshes. The launcher reports an error if port 3000 is already occupied.

## Configure your shop

1. Open **Settings**. Enter your shop name, address, phone, email, website, and a logo if desired, then save the profile. The shop information may appear on customer-facing PDFs.
2. Under **Pricing Defaults**, enter the labor rate, sales tax, default part markup, shop fee and cap, and disposal fee. Choose whether tax applies to parts and labor; save the pricing section. Defaults are examples, so verify them against your actual rates and local tax treatment.
3. Enter your shop ZIP in the profile if you plan to calculate RockAuto shipping.
4. To send email directly, enter your SMTP host, port, username, password, sender address, and connection setting under **Settings → Email**, then save. Leaving the password field blank retains an existing password. Without SMTP, the **Email** action opens a draft in your mail client; attach the generated PDF yourself.

## Create a quote and track a job

1. Open **Quotes → New Quote**. Select a customer or **Add New Customer**, then select or add a vehicle. Add any notes. Existing customer information can be edited on the **Customers** page.
2. Add parts, labor, and other charges. To search RockAuto, select the vehicle, open the parts search, enter the part name or number, and check the listing and fitment before adding it. A per-part shipping amount is an estimate; checkout shipping requires a shop ZIP and a successful RockAuto cart lookup.
3. Review the **Quote Summary**, including shop fees, tax, and shipping. **Mark Sent** changes status but does not send the quote. To share it, use **PDF** or **Email** in the Quotes list.
4. When the customer authorizes work, select **Approve**. This creates a job from a snapshot of the quote. A quote linked to a job is locked against further edits, and linked billing history is protected from deletion through the quote.
5. In **Jobs**, mark checklist items, add mechanic notes, and complete the work. Completion creates a billing ticket.
6. In **Billing**, record that payment was collected in full outside the app, or void an unpaid ticket. The app does not process cards or support partial payments.

Review prices, taxes, shipping, fitment, and AI-generated text before sending a quote or ordering parts. RockAuto site changes can affect search and shipping automation.

## Set up LM Studio (optional)

1. Install [LM Studio for Windows](https://lmstudio.ai/download). Review its [Windows hardware requirements](https://lmstudio.ai/docs/app/system-requirements): CPU capabilities, memory, and available GPU memory affect model compatibility.
2. In LM Studio's **Discover** tab, find and download an instruction/chat model. Load it in LM Studio. The [model suggestions in the main README](README.md#model-suggestions) include small, medium, and larger options; the suggested models have not been benchmarked specifically with this app.
3. Open LM Studio's **Developer** tab and start its local server. Its usual OpenAI-compatible API base address is `http://localhost:1234/v1`; if you chose another local port, use that instead. See the [LM Studio server guide](https://lmstudio.ai/docs/developer/core/server) and [OpenAI-compatible endpoint documentation](https://lmstudio.ai/docs/developer/openai-compat).
4. In AutoQuotes Free, open **Settings → Local AI Assistant (LM Studio)**. Enable local AI features and enter the API base URL ending in `/v1`.
5. Leave **Model** blank to auto-detect, or enter the exact model ID shown in LM Studio. Click **Test Connection**, confirm a model is listed, then click **Save AI Settings**. Testing the connection also enables AI in the settings.
6. In a quote, use **Polish Text**, **Auto-Categorize**, or a part explanation control. Check the results before using them.

If the connection fails, verify that LM Studio's model is loaded, its server is running, and the port and model ID match. The app sends submitted text to the configured endpoint: localhost stays on your PC when the local server is used, while a remote endpoint may receive that data. Review model publisher licenses separately.

## Data, privacy, and backups

The installed application stores user data separately from program files:

- Database: `%LOCALAPPDATA%\AutoQuotes Free\data\autoquote.db`
- Generated quote PDFs: `%LOCALAPPDATA%\AutoQuotes Free\exports\`
- Uploaded logos: `%LOCALAPPDATA%\AutoQuotes Free\uploads\`

Paste `%LOCALAPPDATA%\AutoQuotes Free` into File Explorer's address bar to open the data folder. SQLite may also create `-wal` and `-shm` files while the database is open. Close the app and wait for its server to stop before backing up the entire data folder to a protected location. Customer records and SMTP passwords are not encrypted by the application.

The installer is designed to retain that separate data folder during upgrades and uninstall. Automated uninstall preservation passed on Windows Server; **upgrades and uninstall still need confirmation on Windows 11**. Make a backup before either operation. To uninstall, use **Settings → Apps → Installed apps** in Windows, find **AutoQuotes Free**, and select **Uninstall**. Review the retained folder separately if you later decide to remove your records.

The server is for a single local user and has no login. Do not expose it to a network or the internet. RockAuto receives search and vehicle information; its pages can load third-party resources, and shipping lookup may send the shop ZIP. Email sends the message and PDF to the configured SMTP provider and recipient, or opens a draft in your mail client. AI requests go to the endpoint you configure.

## Troubleshooting

- **Windows warns about the installer:** The beta installer is unsigned. Verify the checksum and assess Windows' warning before choosing whether to run it.
- **Port 3000 is in use:** Close the existing AutoQuotes Free window or stop the other service using that port, then launch again.
- **The browser does not open:** Open `http://127.0.0.1:3000` manually after launching. If the server cannot start, check that port 3000 is free and reinstall the application if needed.
- **The first browser download fails or PDF generation fails:** Check your internet connection and available disk space, then restart AutoQuotes Free to retry the matching Playwright Chromium download.
- **Parts search or shipping fails:** Check internet access, vehicle and engine details, and shop ZIP. RockAuto can change its site, which may break automation.
- **AI connection fails:** Load a model and start the LM Studio server. Check the URL ending in `/v1`, port, and model ID. A smaller model may be faster.
- **Email is not sent:** Check SMTP settings and credentials. With the mail-client fallback, attach the downloaded PDF manually.

## Develop or build from source

Use a Windows 11 x64 checkout, Git, PowerShell, and [Node.js](https://nodejs.org/en/download) 20 or newer; Node.js 22 is recommended. Internet access is needed for npm dependencies and Playwright Chromium. Do not copy `node_modules` from Linux: `better-sqlite3` and Chromium must be installed for Windows. If a native prebuilt module cannot be installed, consult [better-sqlite3's Windows troubleshooting guide](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md).

From the repository directory:

```powershell
.\scripts\setup-windows.cmd
.\scripts\launch-windows.cmd
```

Setup runs `npm ci`, installs Playwright Chromium, and builds the application without clearing an existing database. For development, `npm run dev` opens the API and Vite servers; visit `http://localhost:5173`. Use `npm test`, `npm run build`, and `npm run start:keep` as needed.

Source runs store data under the checkout by default. To keep development records separate, set `AUTOQUOTES_DATA_DIR` before starting:

```powershell
$env:AUTOQUOTES_DATA_DIR = Join-Path $env:LOCALAPPDATA 'AutoQuotes Free Development'
npm run start:keep
```

To build the beta installer on Windows, install [Inno Setup 6](https://jrsoftware.org/isinfo.php), make sure the Node distribution's `LICENSE` is beside `node.exe`, and run:

```powershell
npm ci
npm run build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\build-windows.ps1
```

The script stages a clean copy, installs Windows-native production dependencies, and compiles the installer into `windows-output\` by default. Chromium is downloaded at first launch rather than bundled. The stage excludes the current database, PDFs, and uploaded logos. The Windows runner tests install and uninstall behavior, but a clean Windows 11 desktop test, upgrades, real LM Studio use, and a third-party notice review are still needed before a stable release.

AutoQuotes Free is available under the [MIT License](LICENSE). The bundled dependencies, browsers, and optional models have their own terms.
