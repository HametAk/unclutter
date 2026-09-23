# Install a release

Download the zip from [GitHub releases](https://github.com/HametAk/unclutter/releases). You do not need Bun or a local checkout.

## Chrome, Edge, Brave, and other Chromium browsers

1. Download `unclutter-0.4.0-chrome.zip` (the version in the name matches the release).
2. Unzip it. The folder must contain `manifest.json`.
3. Open `chrome://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and select the unzipped folder.
6. Pin Unclutter, refresh open websites, then open the popup.

To update, download the new zip, unzip over or beside the old folder, and click **Reload** on the extension card. Refresh website tabs. Saved keys, the Ollama model, and page templates stay in extension storage.

Chromium does not install this unsigned zip from the Web Store. Developer mode stays on.

## Firefox 140+

1. Download `unclutter-0.4.0-firefox.zip`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select `manifest.json` inside the unzipped folder.

Temporary add-ons disappear when Firefox quits. A permanent install needs Mozilla signing, which this release does not include.

## After loading

Open the popup and set a connection. The local path is [Ollama](ollama.md). Hosted Jev via Vercel AI Gateway or TypeSafe AI still works if you paste that provider's key.
