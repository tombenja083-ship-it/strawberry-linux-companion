# An free AI platform like clade run on linux mint

A Linux-friendly desktop AI browser companion inspired by the workflow of Strawberry Browser. This is an independent local project, not the proprietary Strawberry application.

## What is included

- Electron desktop app that runs on Linux Mint
- Built-in browser pane with address bar, back/forward navigation, and Google search fallback
- AI companion pane with conversation history
- Optional current-page text context, capped before sending to the model
- OpenAI-compatible API support
- Ollama support through Ollama's OpenAI-compatible endpoint
- Demo mode when no provider is configured
- Skill Studio: draft reusable skills from the current public page, review them, and approve them into a local library
- Approved skill context can be enabled or disabled per chat
- AppImage and Debian package build targets

## Requirements

- Linux Mint 21 or newer is recommended
- Node.js 20+ and npm
- For local AI: Ollama and a downloaded model such as `llama3.2`

## Install on Linux Mint from GitHub

Open Terminal and run:

```bash
sudo apt update
sudo apt install -y git nodejs npm
node --version
npm --version
git clone https://github.com/tombenja083-ship-it/strawberry-linux-companion.git
cd strawberry-linux-companion
npm ci
npm start
```

Node.js 20 or newer is recommended. If `node --version` is lower than 20, install a current Node.js release first, then run the commands above again.

## Run from source

```bash
npm ci
npm start
```

## Build a native installer on Linux Mint

```bash
npm ci
npm test
npm run smoke
npm run dist
```

Then install the Debian package:

```bash
sudo apt install ./dist/strawberry-linux-companion_0.1.0_amd64.deb
```

Or use the AppImage:

```bash
chmod +x ./dist/Strawberry-Linux-Companion-0.1.0.AppImage
./dist/Strawberry-Linux-Companion-0.1.0.AppImage
```

## Configure AI

Open **Settings** in the app.

For OpenAI-compatible services, enter the full chat-completions endpoint, model name, and API key. For Ollama, choose **Ollama (local)**, make sure Ollama is running, and select a model you have installed.

The API key is stored in the app's local user-data configuration. Do not commit it or share the configuration file.

## Connect Gmail, Drive, and Calendar

1. In Google Cloud Console, create or select a project.
2. Configure the OAuth consent screen and add your Google account as a test user if the app is still in testing.
3. Create an OAuth client ID with application type **Desktop app**.
4. Copy the client ID into **Settings → Google OAuth Desktop client ID**.
5. Choose **Connect Google**, complete sign-in, then click the **Google** button to load the overview.

The app requests only these read-only Google permissions:

- Gmail message metadata and snippets through `gmail.readonly`
- Drive file metadata through `drive.metadata.readonly`
- Calendar events through `calendar.readonly`

The app uses a local loopback callback on `127.0.0.1:47823`, encrypts the saved Google token with the operating-system keyring when Electron makes it available, and otherwise keeps it in the local app data directory. The Google data is not sent to the AI provider unless the **Google** checkbox beside the chat composer is explicitly enabled.

## Learn reusable skills online

1. Open a public guide, tutorial, or documentation page in the built-in browser.
2. Click **Learn skill**.
3. Describe what you want the skill to teach.
4. Click **Learn from page** to draft a `SKILL.md` from the visible page text.
5. Review the draft and click **Approve & save**.
6. Leave the **Skills** checkbox enabled when you want approved skills applied to a chat.

Skills are stored under the app's local user-data directory. The app never auto-installs packages, executes scripts downloaded from a page, or silently replaces an existing skill. The draft is reference material and must be reviewed before saving.

## Test the app

Run the portable project checks on any platform:

```bash
npm test
```

On Linux Mint or another Linux desktop, run the Electron startup smoke test:

```bash
npm run smoke
```

The GitHub Actions workflow runs both checks under a virtual Ubuntu/Linux display before building the AppImage and Debian package. For an exact Linux Mint test, run the same commands on the target Mint machine; this Windows development host does not have a Linux distribution installed.

## Build through GitHub Actions

The repository includes `.github/workflows/build-linux.yml`. Push this folder to GitHub, run the workflow, and download the AppImage and `.deb` artifacts from the completed workflow.

## Current boundaries

This version does not yet include browser sync, multi-agent delegation, voice transcription, or a cloud backend. Google integration is read-only in this release; sending email, editing Drive files, and creating or changing Calendar events are intentionally not implemented. Skill learning creates reviewed Markdown workflow files only; it does not install or run arbitrary code from the web. Those actions should be added as separate, tested modules with separate user approval rather than broad permissions in the renderer process.
