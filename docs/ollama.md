# Ollama and SemIf

This fork classifies page elements with [SemIf](https://github.com/TheoLeeCJ/SemIf)'s direct letter readout on a local [Ollama](https://ollama.com) model. SemIf is an independent project. It does not run TypeSafe Jev and its probabilities are not Jev's calibrated confidence.

## Model

```sh
ollama pull qwen3.5:4b-mlx
```

`qwen3.5:4b` is the same family without the MLX build. Any instruct model that can put the letters A–G in its top logprobs can be typed into the popup. The checked default is `qwen3.5:4b-mlx`.

## Allow the extension origin

Ollama answers `curl` on localhost and still returns **HTTP 403** to the extension. The browser sends `Origin: chrome-extension://…` (or `moz-extension://…` / `safari-extension://…`). Ollama 0.34 allows only the origins in `OLLAMA_ORIGINS`, plus localhost.

Set:

```sh
OLLAMA_ORIGINS=chrome-extension://*,moz-extension://*,safari-extension://*
```

Restart the Ollama app after the variable is set. A process that was already running keeps the old environment.

### macOS app

```sh
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*,safari-extension://*"
```

Quit Ollama completely, then open it again from the same login session. `launchctl setenv` does not survive a reboot. To apply it at each login, a LaunchAgent can run that `setenv` with `RunAtLoad`. The menu-bar app still has to start after the variable exists, so quit and reopen Ollama once after login if analysis returns 403.

### Linux

Put the variable in the systemd unit or the shell that starts `ollama serve`, then restart the service.

### Windows

Set `OLLAMA_ORIGINS` in the user environment, quit Ollama from the tray, and start it again.

## Popup

1. **Connection** → **Ollama (SemIf)**.
2. Model: `qwen3.5:4b-mlx` (or the tag you pulled).
3. Host: `http://127.0.0.1:11434`.
4. Save.

No API key is sent. The model name and host are stored in local extension storage, unencrypted and unsynced, the same way a hosted key is stored.

## What a request does

Each candidate is one `POST /api/chat` with thinking disabled, `num_predict: 1`, and `top_logprobs: 20` (Ollama's maximum). SemIf reads the logprobs of the letters A–G. Those letters map to keep, ad, promotion, newsletter, social, cookie, and uncertain.

A clutter category is hidden only when its probability is at least 0.5 and it leads both `keep` and `uncertain` by 0.12. Missing letters leave that element visible. Up to 60 candidates are scored one after another, so the first analysis waits on model load plus one forward pass per element. Later visits reuse the saved template and do not call Ollama.

Snippets are tag, structural signals, a short text sample, position, and match count. The full URL, query string, page title, main article, form values, cookies, and raw HTML are not sent. They go only to the host saved in the popup.

## Smoke test

From a checkout, with no hosted key in the environment:

```sh
OLLAMA_MODEL=qwen3.5:4b-mlx OLLAMA_HOST=http://127.0.0.1:11434 bun scripts/smoke-jev.ts
```

Do not set `OLLAMA_MODEL` together with `JEV_KEY`, `TYPESAFE_API_KEY`, or `AI_GATEWAY_API_KEY`.
