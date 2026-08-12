# `learning-plugin`

```text
> add topic
> generate 2 cards
> learn something technical
```

A compact WebExtensions MV3 learning tool with a terminal-style UI.

## `> stack`

```text
ui         React + TypeScript
runtime    WebExtensions MV3
build      Vite
providers  Ollama / Gemini / OpenAI
default    Ollama + qwen2.5:3b
```

## `> what it does`

- keeps a local topic queue
- orders topics with lightweight prerequisite logic
- shows 2 visible lesson cards at a time
- generates cards with a local or hosted LLM
- stores history, settings, and reminders locally

## `> install`

```bash
npm install
npm run typecheck
npm run test
```

## `> build`

Chrome / Edge / Opera:

```bash
npm run build
```

Firefox:

```bash
npm run build:firefox
```

All browser targets:

```bash
npm run build:all
```

## `> load in firefox`

```text
1. run npm run build:firefox
2. open about:debugging#/runtime/this-firefox
3. click "Load Temporary Add-on"
4. choose builds/firefox/manifest.json
```

## `> load in chrome`

```text
1. run npm run build
2. open chrome://extensions or your browser's extensions page
3. enable Developer mode
4. click "Load unpacked"
5. choose builds/chrome/
```

## `> ollama`

Pull the default model:

```powershell
ollama pull qwen2.5:3b
```

Useful checks:

```powershell
ollama list
ollama ps
```

Firefox fallback if the extension cannot connect:

```powershell
$env:OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*,safari-web-extension://*"
ollama serve
```

## `> commands`

```bash
npm run dev
npm run typecheck
npm run test
npm run build
npm run build:edge
npm run build:opera
npm run build:firefox
npm run build:all
```

## `> structure`

```text
src/background/   background runtime + messaging
src/domain/       planning, inference, resources
src/pages/        dashboard, settings, history, about
src/providers/    Ollama / Gemini / OpenAI adapters
src/storage/      local state + migrations
src/styles/       terminal-themed UI
tests/            planner, resources, settings, migration tests
```

## `> repo`

[github.com/EdwardGlockner/learner-extension](https://github.com/EdwardGlockner/learner-extension)

## `> browser artifacts`

```text
dist/            latest single-target build
builds/chrome/   Chrome-compatible artifact
builds/edge/     Edge-compatible artifact
builds/opera/    Opera-compatible artifact
builds/firefox/  Firefox-compatible artifact
```
