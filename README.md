# `learning-plugin`

```text
> queue a topic
> generate two cards
> learn something technical
```

`learning-plugin` is a Manifest V3 WebExtensions extension for compact daily learning.
It opens as a focused dark popup window, keeps a prerequisite-aware topic queue, and generates two lesson cards at a time with a local or hosted LLM.

The current default path is:

```text
provider  : Ollama
model     : qwen2.5:3b
style     : terminal / AI console
target    : Firefox + Chrome-family browsers
```

## `> features`

- local-first topic queue stored in `browser.storage.local`
- prerequisite-aware ordering with category mixing
- two visible lesson cards at a time
- inline history, settings, and help pages inside the extension window
- Ollama support with Firefox-specific setup help
- Gemini support as a hosted fallback
- reminder notifications with test flow
- resilient lesson parsing for messy local-model output
- deep-dive resources with curated links and deduplication

## `> stack`

```text
ui         React + TypeScript
build      Vite
runtime    WebExtensions MV3
compat     webextension-polyfill
tests      Vitest
```

Main folders:

```text
public/           manifest + icons
src/background/   runtime + message handlers
src/domain/       queue ordering + topic inference + resources
src/pages/        dashboard / settings / history / about
src/providers/    Ollama / Gemini / OpenAI adapters
src/storage/      local state + migrations
src/styles/       terminal-themed UI
tests/            planner + settings coverage
```

## `> quick start`

### `1. install deps`

```bash
npm install
```

### `2. validate`

```bash
npm run typecheck
npm run test
```

### `3. build`

Chrome / Edge / Opera:

```bash
npm run build
```

Firefox:

```bash
npm run build:firefox
```

## `> load in firefox`

```text
1. run npm run build:firefox
2. open about:debugging#/runtime/this-firefox
3. click "Load Temporary Add-on"
4. choose dist/manifest.json
```

Reload the temp add-on after each build.

## `> ollama setup`

Install Ollama, start the app, then pull the default model:

```powershell
ollama pull qwen2.5:3b
```

Check that Ollama is available:

```powershell
ollama list
ollama ps
```

If Firefox can reach `http://127.0.0.1:11434` in the browser but the extension still cannot connect, start Ollama with extension origins enabled:

```powershell
$env:OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*,safari-web-extension://*"
ollama serve
```

Notes:

- `qwen2.5:3b` is the default because it is much lighter than `gemma3`
- the extension generates one card at a time to reduce local load
- if your machine still struggles, the real fix is using an even smaller local model

## `> provider notes`

### `Ollama`

- default provider
- no API key needed
- best option if you want local generation and no hosted quota

### `Gemini`

- available in Settings
- useful if you want a hosted provider instead of local inference

### `OpenAI`

- adapter remains in the codebase
- available for future expansion

## `> what the extension actually does`

```text
new topic      -> inferred category + lightweight prerequisites
queue order    -> foundations first, related topics nearby, variety when possible
visible cards  -> first 2 eligible topics
generation     -> only for visible topics, one card at a time
history        -> stores finished topics and old lessons
resources      -> curated links first, generated links filtered + deduped
```

## `> architecture notes`

- `src/domain/planner.ts`
  queue ordering, prerequisite handling, visible-topic selection
- `src/domain/topicInference.ts`
  category/tag inference from raw topic titles
- `src/domain/resources.ts`
  curated deep-dive links and deduplication
- `src/background/runtime.ts`
  loading, generation, alarms, notifications, toolbar window flow
- `src/providers/ollamaProvider.ts`
  local generation, validation, repair pass, lighter inference options
- `src/providers/shared.ts`
  prompt rendering, JSON parsing, Ollama fallback parsing
- `src/storage/state.ts`
  versioned extension state + migrations

## `> commands`

```bash
npm run dev            # watch build
npm run typecheck      # TypeScript
npm run test           # Vitest
npm run build          # Chrome-family manifest
npm run build:firefox  # Firefox manifest
```

## `> packaging`

### `chrome-family`

- build with `npm run build`
- load `dist/` as unpacked
- zip `dist/` for store submission

### `firefox`

- build with `npm run build:firefox`
- load `dist/manifest.json` as a temporary add-on
- for distribution, package `dist/` as an `.xpi` / zip with the Firefox manifest

## `> repository`

[github.com/EdwardGlockner/learner-extension](https://github.com/EdwardGlockner/learner-extension)

## `> next`

- better local-model output shaping without strict JSON dependence
- more curated resource rules for niche technical topics
- import/export for queue state
- sync-friendly storage model
- browser-store packaging polish
