# AutoQuotes Free — Linux Edition

**Version 1.0.0** · Local automotive repair quotes, jobs, and billing tracking for Linux

AutoQuotes Free helps a repair shop prepare estimates, track the work approved by a customer, and record whether a completed job has been paid. It runs a local Node.js server and opens in your browser. Your shop and customer records are stored in a local SQLite database. The optional AI assistant connects to LM Studio; pricing calculations do not depend on AI.

This is the **Linux edition**, intended for a single user on one computer. It is a source-based application, not an installed system package or a hosted service.

## What it does

- Create and search quotes with customer and vehicle information, parts, labor, miscellaneous items, notes, and priority labels.
- Calculate part markups, labor, configured shop and disposal fees, tax, and shipping. Review the pricing settings for your shop and jurisdiction.
- Search RockAuto parts for a vehicle, add results to a quote, and estimate shipping. Internet access is required for this feature.
- Approve a quote to create a mechanic job; track checklist items and completion notes.
- Open a billing ticket when a job is completed and record payment in full or void the ticket. Payment is collected separately; the app is not a payment processor.
- Generate PDF quotes and email them through a configured SMTP server or your default email app.
- Optionally polish notes, explain parts, and suggest priorities with an LM Studio model running locally.

> Prices, shipping, part fitment, and AI text are estimates or suggestions. Verify them before communicating with customers or ordering parts. RockAuto pages can change, which can affect searches or shipping estimates.

## Linux requirements

- A Linux desktop, a terminal, and a modern browser such as Chrome or Chromium.
- [Node.js 22 LTS](https://nodejs.org/en/download) and npm. This project has been tested with Node.js 22. Newer Node.js versions may require a compatible native build of `better-sqlite3`.
- Git, Python 3, a C/C++ compiler, and `make` may be needed to install native dependencies. On Debian/Ubuntu, for example: `sudo apt install git python3 make g++`.
- Internet access for dependency installation and Playwright's Chromium download. RockAuto features also require internet access.
- Disk space for dependencies, Chromium, your local records, and optionally downloaded AI models.
- Optional: [LM Studio for Linux](https://lmstudio.ai/download) and enough RAM/VRAM for the chosen model. See [LM Studio's Linux system requirements](https://lmstudio.ai/docs/app/system-requirements).

LM Studio is optional. You can create quotes and use the pricing, jobs, and billing features without it.

## Installation

1. Clone the repository and open its directory:

   ```bash
   git clone https://github.com/haxt3r-pixel/AutoQuotes-Free.git
   cd AutoQuotes-Free
   ```

2. Install the Node.js dependencies:

   ```bash
   npm ci
   ```

3. Install Playwright's Chromium browser for PDF generation and RockAuto features:

   ```bash
   npx playwright install chromium
   ```

   On a supported Debian/Ubuntu system, if Chromium reports missing Linux libraries, install Playwright's system dependencies (this can request administrator access):

   ```bash
   npx playwright install-deps chromium
   ```

4. Build the application:

   ```bash
   npm run build
   ```

5. Start it and open the local address:

   ```bash
   npm start
   ```

   Visit **http://127.0.0.1:3000** in your browser. The first launch creates a fresh local database with a generic shop profile and no customer records. It will also apply any pending database migrations.

For a desktop-style launch after building, use `bash scripts/launch.sh`; it starts the server and opens a browser. It stops rather than opening a different application if port 3000 is already occupied.

The normal production server shuts down after the browser tab closes or heartbeats stop, with a short grace period for refreshes. Use `npm run start:keep` if the server should stay running; stop it with **Ctrl+C** in the terminal.

For development, `npm run dev` starts the API and Vite development server; open **http://localhost:5173**. Run `npm test` for the automated tests. `npm run db:init` initializes or migrates the configured database; it does not clear existing records.

## First-time shop setup

Open **Settings** and enter the shop profile and logo if desired. Set the labor rate, parts markup, shop fee and cap, disposal fee, and whether sales tax applies to parts and labor. Save each section. Enter the shop ZIP code in the profile if you want RockAuto shipping estimates.

The default profile is generic. Enter only information you want on customer-facing PDFs. Pricing defaults are starting values; check that they match your actual rates and local tax treatment.

To send emails directly, enter your SMTP host, port, username, sender address, and password under **Settings → Email**. A blank password field retains an existing saved password. Without SMTP, the **Email** action opens a draft in your default mail client; attach the PDF manually before sending.

## Using AutoQuotes Free

1. Go to **Quotes → New Quote**. Select an existing customer or use **Add New Customer**, then select or add a vehicle. Customer details can be edited on the **Customers** page. Enter notes as needed.
2. Add part, labor, miscellaneous, and fee line items manually. For a part search, choose the vehicle, open the parts search, enter a part name or number, review fitment and price, and add the desired result. A per-part shipping figure is an estimate; checkout-based shipping requires a shop ZIP and a successful RockAuto cart lookup.
3. Review the **Quote Summary**, including tax, shop fees, and shipping. Use **Mark Sent** if appropriate; it changes the quote status but does not itself email the customer. Use **PDF** or **Email** on the Quotes list to share a quote.
4. Select **Approve** once the customer authorizes the work. Approval creates a job with a snapshot of the quote. Quotes with linked jobs are locked against further edits to protect the job's saved prices; linked work and billing history cannot be deleted through the quote.
5. Open **Jobs**, mark checklist items complete, enter mechanic notes, and complete the work. Completion creates a billing ticket.
6. Open **Billing** to record full payment collected outside the app, or void an unpaid ticket. Partial payments and card processing are not supported.

## Set up LM Studio (optional)

1. Install [LM Studio](https://lmstudio.ai/download) for Linux and check its [system requirements](https://lmstudio.ai/docs/app/system-requirements).
2. In LM Studio's **Discover** tab, search for an instruction/chat model, choose a compatible download, and download it. In **Chat**, select and load the model. See [LM Studio's getting-started guide](https://lmstudio.ai/docs/app/basics).
3. Open LM Studio's **Developer** tab and start its local server. The usual address is `http://localhost:1234`; the OpenAI-compatible API base URL is `http://localhost:1234/v1`. See [LM Studio's server guide](https://lmstudio.ai/docs/developer/core/server) and [OpenAI-compatible endpoints](https://lmstudio.ai/docs/developer/openai-compat).
4. In AutoQuotes Free, open **Settings → Local AI Assistant (LM Studio)**. Enable local AI features and enter `http://localhost:1234/v1`, or the actual local URL and port you configured.
5. Leave **Model** blank to auto-detect a model, or enter the exact model identifier shown by LM Studio. Click **Test Connection**, verify that the expected model is listed, and click **Save AI Settings**. Testing also enables the AI setting.
6. In a quote, use **Polish Text**, **Auto-Categorize**, or a part explanation control. Review the result before using it.

If connection fails, check that the model is loaded, the server is started, the port matches, and the URL ends in `/v1`. You can inspect the model list in a terminal:

```bash
curl http://localhost:1234/v1/models
```

### Model suggestions

These are starting points for instruction-following tasks, not guaranteed fit or quality. They have not been benchmarked specifically with AutoQuotes Free. Search their names in LM Studio and choose a compatible GGUF quantization such as `Q4_K_M` when available:

| Model | When to try it |
| --- | --- |
| [Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF) | Small option for limited memory; may be less reliable at categorization and structured output. |
| [Qwen2.5-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF) | A practical starting point if your computer has enough memory; test speed and output quality. |
| [Qwen2.5-14B-Instruct](https://huggingface.co/Qwen/Qwen2.5-14B-Instruct-GGUF) | Larger option for machines with more available memory; expect slower inference or higher memory use. |

Model size, quantization, context length, available RAM/VRAM, GPU support, and concurrent apps all affect whether a model fits and how quickly it responds. Start smaller if loading fails. Model downloads and licenses are provided separately by their publishers; review the model's terms before using it.

The app sends the text you submit for AI actions to the configured endpoint. Keeping the endpoint at localhost keeps those requests on your machine when LM Studio is running locally. A remote endpoint or a remote model-serving configuration can send that data elsewhere; see [LM Studio's offline documentation](https://lmstudio.ai/docs/app/offline).

## Data, backups, and network access

- `data/autoquote.db` holds shop settings, customers, vehicles, quotes, jobs, and billing data. SQLite may also create `-wal` and `-shm` files while the database is open.
- `exports/` holds generated PDF quotes and `uploads/` holds uploaded logos. They can contain private information.
- Stop the app cleanly before copying the database for a backup, and back up the database, PDFs, and uploads to a protected location. Keep backups private. The database and SMTP password are not encrypted by the application.
- Git and npm package exclusions are intended to keep runtime data out of the repository and npm archive. They do not sanitize a full folder or ZIP you share after entering real customer data.
- The server binds to loopback and has **no login or authentication**. Use it as a local single-user application; do not expose it to a network or the internet.
- RockAuto searches send part queries and vehicle information to RockAuto; adding a searched part also interacts with its cart in the background. Shipping lookup can send the shop ZIP. RockAuto pages may load third-party resources.
- Sending email shares the message and PDF with the configured SMTP provider and recipient, or hands a draft to your mail client. The default AI endpoint is local but can be changed in settings.
- Installing dependencies, Playwright, LM Studio, and models requires contacting their respective download services.

## Troubleshooting

- **Port 3000 is already in use:** Stop the other service before starting the launcher, or configure a different port for a manual server run.
- **PDF generation fails:** Confirm Playwright Chromium and the required Linux libraries are installed, then retry.
- **Parts search or shipping fails:** Confirm internet access, vehicle/engine and ZIP details, and the availability of RockAuto's site. Search and checkout automation can break if the site changes.
- **AI connection fails:** Start LM Studio's server, load a compatible model, and check the `/v1` URL and model identifier. Slow models can time out.
- **Email is not sent:** Check SMTP settings and credentials. If using the mail-client fallback, attach the downloaded PDF yourself.
- **Changes do not appear in production:** Run `npm run build` again and restart the server.

## Project layout

`frontend/` contains the React user interface; `src/` contains the Express server, pricing logic, database repositories, integrations, and migrations. `tests/` contains automated tests. The database and other runtime files stay on the computer where you run the app. The bundled vehicle catalog was created as part of this project and is a convenience dataset; verify vehicle fitment independently before ordering parts.

## License

AutoQuotes Free is released under the [MIT License](LICENSE). Third-party packages and AI models have their own licenses.
