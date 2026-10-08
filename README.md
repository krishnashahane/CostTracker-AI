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
- No build step.

## Run locally

Clone the repository:

```bash
git clone https://github.com/krishnashahane/CostTracker-AI.git
cd CostTracker-AI
```

You can open index.html directly in a modern browser.

For a local HTTP server:

```bash
python3 -m http.server 8080
```

Then open http://127.0.0.1:8080/.

## Data and privacy

All user-entered tracking data is stored locally in the browser.

The app has no backend, API, database, analytics service, authentication system, or server-side cost collector.

Chart rendering uses a pinned Chart.js 4.5.1 release loaded from cdnjs. If the chart library cannot be loaded, the dashboard displays a fallback message and the underlying data remains available.

Because data is stored locally, clearing site data or browser storage removes the tracked entries and budget unless you exported them first.

## Storage safeguards

Browser data is validated when loaded. Invalid or malformed stored entries are discarded instead of being trusted blindly.

Practical bounds include:

- Maximum 5,000 stored entries.
- Provider names: 64 characters.
- Model names: 128 characters.
- Notes: 500 characters.
- Costs and token counts must be finite, non-negative numbers within application limits.

## Security hardening

- User-controlled values are rendered with DOM APIs rather than injected as HTML.
- CSV export escapes fields correctly.
- Stored JSON is validated before use.
- Delete actions use event listeners rather than interpolating user data into inline handlers.
- External GitHub links opened in a new tab use noopener/noreferrer.
- Local environment files are ignored by Git.
- No API keys or provider credentials are required.

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

## Tech stack

- HTML5
- CSS3
- Vanilla JavaScript
- Browser localStorage
- Chart.js 4.5.1 via cdnjs

## Repository structure

```text
CostTracker-AI/
├── index.html
├── app.js
├── style.css
├── .env.example
├── .gitignore
└── README.md
```

## Limitations

CostTracker AI is a local tracking dashboard, not an automatic cloud billing collector.

It cannot discover provider usage by itself. Enter costs from your provider billing data manually.

## Contributing

Open an issue or pull request with a reproducible bug, focused improvement, or security finding.

## License

MIT
