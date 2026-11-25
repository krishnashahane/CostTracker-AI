# CostTracker AI

CostTracker AI is a browser-only dashboard for manually tracking AI API spending.

It stores tracked entries and the monthly budget in browser localStorage. It does not connect to provider billing APIs and it does not send tracked data to a backend.

## Features

- Manual cost tracking across OpenAI, Anthropic, Google AI, Mistral, Cohere, AWS Bedrock, Azure OpenAI, and other providers.
- Spending charts for 7, 30, and 90 days.
- Provider breakdown and quick statistics.
- Monthly budget with 80% and 100% alerts.
- CSV export.
- Dark/light theme.
- Responsive desktop and mobile layout.
- Keyboard and screen-reader friendly controls (labelled form fields, focus indicators, reduced-motion support, improved muted-text contrast).
- No build step.

## Run locally

Clone the repository:

```bash
git clone https://github.com/krishnashahane/CostTracker-AI.git
cd CostTracker-AI
```

Serve it over HTTP (recommended):

```bash
python3 -m http.server 8080
```

Then open http://127.0.0.1:8080/. `npm run serve` does the same.

You can also open `index.html` directly in a modern browser. Chart.js is bundled in `vendor/`, so no network access is needed.

## Data and privacy

All user-entered tracking data is stored locally in the browser.

The app has no backend, API, database, analytics service, authentication system, or server-side cost collector. It makes no third-party network requests.

Chart rendering uses Chart.js 4.5.1, vendored unmodified in `vendor/` (see `vendor/README.md` for provenance and checksums). If the chart library cannot be loaded, the dashboard displays a fallback message and the underlying data remains available.

Because data is stored locally, clearing site data or browser storage removes the tracked entries and budget unless you exported them first. **Reset** in the dashboard deletes entries, the budget, and any recovery backup.

## Storage safeguards

Browser data is validated when loaded. Invalid or malformed stored entries are not shown, but nothing is silently destroyed: if stored data cannot be parsed or contains invalid entries, the original text is copied to the `costtracker_entries_backup` localStorage key and the dashboard shows a notice.

If the browser refuses to save (private mode, full storage), the dashboard keeps working for the session and warns you to export your data.

Practical bounds include:

- Maximum 5,000 stored entries (the oldest entry is dropped when the limit is exceeded, and you are told).
- Provider names: 64 characters.
- Model names: 128 characters.
- Notes: 500 characters.
- Costs and token counts must be finite, non-negative numbers within application limits.
- Dates must be real calendar dates (for example, 2026-02-31 is rejected).

## Security hardening

- A Content Security Policy (`<meta>` tag) limits scripts, styles, images, and connections to the site's own origin. There are no inline scripts, inline event handlers, or inline style attributes.
- User-controlled values are rendered with DOM APIs (`textContent`) rather than injected as HTML. ESLint (`eslint-plugin-no-unsanitized`) fails the build on `innerHTML`-style sinks and `eval`.
- CSV export escapes quotes and neutralises spreadsheet formula injection (values starting with `=`, `+`, `-`, `@`, tab, or carriage return are prefixed with `'`).
- Stored JSON is validated before use.
- Delete actions use event listeners rather than interpolating user data into handlers.
- External links opened in a new tab use `noopener noreferrer`.
- Chart.js is served from this repository and checked against a pinned SHA-256 in the test suite.
- Local environment files are ignored by Git. No API keys or provider credentials are required.

Clickjacking protection (`frame-ancestors` / `X-Frame-Options`) cannot be set from a `<meta>` tag. If you host the app, send `Content-Security-Policy: frame-ancestors 'none'` (or `X-Frame-Options: DENY`) as an HTTP response header from your web server or hosting provider.

## Supported providers

| Provider |
| --- |
| OpenAI |
| Anthropic |
| Google AI |
| Mistral |
| Cohere |
| AWS Bedrock |
| Azure OpenAI |
| Other |

Other can be used for providers that are not listed.

## Development

The app itself needs no tooling. The checks below use Node.js 22 or newer.

```bash
npm ci            # install dev dependencies (ESLint, jsdom)
npm run lint      # ESLint, including unsafe-sink rules
npm test          # unit/integration tests (node:test + jsdom)
npm run check     # lint + tests + npm audit
```

The tests cover navigation and event wiring, input validation, XSS handling, CSV export, storage recovery, budget and weekly calculations, chart setup, accessibility basics, and a guard that the page contains no inline handlers or styles that the CSP would block. CI runs the same checks on every push and pull request.

## Tech stack

- HTML5
- CSS3
- Vanilla JavaScript
- Browser localStorage
- Chart.js 4.5.1 (vendored)

## Repository structure

```text
CostTracker-AI/
├── index.html
├── app.js
├── style.css
├── vendor/
│   ├── chart.umd.min.js
│   ├── chartjs-LICENSE.md
│   └── README.md
├── tests/
├── .github/workflows/ci.yml
├── eslint.config.js
├── package.json
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

## Limitations

CostTracker AI is a local tracking dashboard, not an automatic cloud billing collector.

It cannot discover provider usage by itself. Enter costs from your provider billing data manually.

Data is per browser profile and per origin; it is not synced between devices. Use CSV export to move or back up your data.

## Contributing

Open an issue or pull request with a reproducible bug, focused improvement, or security finding. Run `npm run check` before submitting.

## License

MIT
