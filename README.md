# learning-plugin

`learning-plugin` is a production-minded cross-browser browser extension built on the WebExtensions model with Manifest V3. It opens as a compact popup, lets users maintain a custom queue of learning topics, and generates up to 2 daily lesson cards with prerequisite-aware scheduling, variety balancing, reminder notifications, and a swappable LLM provider abstraction.

## Architecture summary

- UI: React + TypeScript extension UI with a compact popup dashboard and a matching settings window.
- Runtime: Manifest V3 background service worker handles toolbar clicks, daily plan creation, lesson generation, alarms, and notifications.
- Domain logic: Pure scheduling and prerequisite inference logic lives in `src/domain`, separate from storage and UI.
- Storage: Local-first state stored in `browser.storage.local` as a versioned `ExtensionState`.
- Provider layer: Clean `LessonProvider` interface with Gemini and OpenAI adapters.
- Compatibility: Uses `webextension-polyfill`, the modern `action` API, MV3 service worker flow, minimal permissions, and a manifest shape that ports cleanly across Chrome-family browsers and Firefox with minor packaging adjustments.

## Folder structure

```text
learning-plugin/
├─ public/
│  ├─ icons/
│  └─ manifest.json
├─ src/
│  ├─ background/
│  │  ├─ index.ts
│  │  └─ runtime.ts
│  ├─ domain/
│  │  ├─ planner.ts
│  │  └─ topicInference.ts
│  ├─ lib/
│  │  ├─ browserApi.ts
│  │  ├─ id.ts
│  │  ├─ messages.ts
│  │  ├─ strings.ts
│  │  ├─ theme.ts
│  │  └─ time.ts
│  ├─ pages/
│  │  ├─ dashboard/
│  │  ├─ history/
│  │  ├─ manage/
│  │  └─ options/
│  ├─ providers/
│  │  ├─ geminiProvider.ts
│  │  ├─ index.ts
│  │  ├─ openAiProvider.ts
│  │  ├─ shared.ts
│  │  └─ types.ts
│  ├─ shared/
│  │  ├─ constants.ts
│  │  ├─ messages.ts
│  │  ├─ seed.ts
│  │  └─ types.ts
│  ├─ storage/
│  │  ├─ selectors.ts
│  │  └─ state.ts
│  ├─ styles/
│  │  └─ index.css
│  └─ ui/
│     ├─ components/
│     ├─ hooks/
│     └─ layout/
├─ tests/
│  └─ planner.test.ts
├─ dashboard.html
├─ history.html
├─ manage.html
├─ options.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## Core behavior

- Starts empty like a new-user install, then builds the queue from topics the user adds.
- Infers initial categories and lightweight prerequisite suggestions, then merges them with editable manual prerequisites.
- Builds a daily plan of 2 or 3 topics based on:
  - unmet prerequisite filtering
  - foundational weighting
  - variety penalties across categories and tags
  - unseen-topic preference
  - spaced review reintroduction
  - deterministic tie-breaking for easier debugging
- Stores topic state, reminder state, and provider settings locally.
- Shows a provider connection prompt when lesson generation is unavailable instead of using local fallback content.

## Setup

### Prerequisites

- Node.js 20+ recommended
- npm 10+

### Install

```bash
npm install
```

### Typecheck

```bash
npm run typecheck
```

### Run tests

```bash
npm run test
```

### Build

```bash
npm run build
```

The built extension will be emitted to `dist/`.

For a Firefox-loadable development build, use:

```bash
npm run build:firefox
```

## Load in a browser

### Chrome / Edge / Opera

1. Run `npm run build`.
2. Open the browser extension management page.
3. Enable developer mode.
4. Choose “Load unpacked”.
5. Select the `dist/` folder.

### Firefox

1. Run `npm run build:firefox`.
2. Open `about:debugging`.
3. Choose “This Firefox”.
4. Click “Load Temporary Add-on”.
5. Select any file inside `dist/`, typically `manifest.json`.

For a signed Firefox submission, keep `browser_specific_settings.gecko.id` and package the contents of `dist/` into a zip/xpi.

## Packaging notes

### Chrome-family browsers

- The extension already uses Manifest V3 with `background.service_worker`.
- Package the built `dist/` directory as a zip for store submission.
- The manifest keeps permissions minimal: `storage`, `alarms`, and `notifications`, plus host permissions for OpenAI and Gemini generation endpoints.

### Firefox

- Firefox gets a browser-specific MV3 manifest at build time.
- `npm run build:firefox` rewrites `dist/manifest.json` to use `background.scripts` instead of `background.service_worker`.
- Chrome-family browsers keep the `background.service_worker` manifest via `npm run build` or `npm run build:chrome`.

## Provider notes

- Gemini is the default provider for lightweight free-tier testing, implemented in `src/providers/geminiProvider.ts`.
- OpenAI remains available as an alternative provider in `src/providers/openAiProvider.ts`.
- API keys are stored in extension storage with a clear warning because browser extensions cannot guarantee secret storage against a local privileged attacker.
- Prompt templates are editable from the settings page and support these placeholders:
  - `{{topicTitle}}`
  - `{{topicDescription}}`
  - `{{category}}`
  - `{{difficultyPreference}}`
  - `{{contentLength}}`
  - `{{relatedTopics}}`

## Testing

The repository includes unit-testable pure planning logic in `src/domain/planner.ts` with tests covering:

- prerequisite-aware ordering
- category/tag variety scoring
- review resurfacing for previously learned topics

## Future improvements

- Add provider adapters for Anthropic and local OpenAI-compatible endpoints via optional host permissions.
- Introduce import/export and sync storage migration paths.
- Add richer spaced-repetition models instead of the current lightweight review interval heuristic.
- Support manual “understood / not understood” feedback separate from lesson status buttons.
- Add browser-specific manifest generation for release packaging instead of a single shared static manifest.
