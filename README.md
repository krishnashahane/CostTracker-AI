# CostTracker AI

Beautiful, privacy-first dashboard to track and optimize your AI API spending across all major providers.

**[costtracker.io](https://costtracker.io)**

![CostTracker AI Dashboard](https://img.shields.io/badge/CostTracker-AI-6366f1?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

## Features

- **Multi-Provider Tracking** — OpenAI, Anthropic, Google AI, Mistral, Cohere, AWS Bedrock, Azure OpenAI
- **Real-time Dashboard** — Interactive charts, spending trends, provider breakdown
- **Budget Alerts** — Set monthly spending limits and get warned before overspending
- **Privacy First** — All data stored locally in your browser. Nothing leaves your machine
- **CSV Export** — Export your data anytime for reporting and analysis
- **Dark/Light Mode** — Beautiful UI that adapts to your preference
- **Zero Dependencies** — Pure HTML, CSS, and vanilla JS (only Chart.js for charts)
- **Mobile Responsive** — Works on desktop, tablet, and phone

## Quick Start

1. Clone the repo:
   ```bash
   git clone https://github.com/krishnashahane/CostTracker-AI.git
   cd CostTracker-AI
   ```

2. Open `index.html` in your browser — that's it!

   Or serve it locally:
   ```bash
   npx serve .
   ```

3. Start tracking your AI costs.

## How It Works

CostTracker AI runs entirely in your browser. You manually log your API costs (or integrate with your billing data via CSV). All data is stored in `localStorage` — nothing is ever sent to any server.

### Supported Providers

| Provider | Color |
|----------|-------|
| OpenAI | Green |
| Anthropic | Orange |
| Google AI | Blue |
| Mistral | Orange |
| Cohere | Indigo |
| AWS Bedrock | Amber |
| Azure OpenAI | Blue |
| Custom | Purple |

## Tech Stack

- Vanilla HTML5 / CSS3 / JavaScript
- [Chart.js](https://www.chartjs.org/) for interactive charts
- localStorage for data persistence
- Zero build step — just open and use

## Contributing

Contributions are welcome! Feel free to open issues and pull requests.

## License

[MIT](LICENSE) — Krishna Shahane
