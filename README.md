# DhuBot

A Slack bot that makes expense reimbursements easy. Snap a receipt, let AI extract the details, and submit to Harvest automatically.

## Features

- **AI-Powered Receipt Parsing** - Uses Claude to extract date, amount, and currency from receipt images
- **Auto Currency Conversion** - Converts foreign currencies to USD using real-time exchange rates
- **Harvest Integration** - Submits expenses directly to your Harvest account
- **Smart Cutoff Tracking** - Tracks spending per payroll cutoff period

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Node.js](https://nodejs.org/) | Runtime |
| [Slack Bolt](https://slack.dev/bolt-js/) | Slack app framework |
| [Anthropic Claude](https://anthropic.com/) | AI receipt parsing (via AWS Bedrock) |
| [Harvest API](https://help.getharvest.com/api-v2/) | Expense management |
| [Day.js](https://day-sj.github.io/dayjs/) | Date handling |

## Commands

| Command | Description |
|---------|-------------|
| `/configure` | Connect your Harvest account |
| `/reimburse-transpo` | Quick reimbursement for transportation expenses |
| `/reimburse-wellness` | Quick reimbursement for health & wellness expenses |
| `/reimburse` | Manual expense entry with custom details |
| `/reimbursement-status` | Check your current balance and usage |

## Setup

### Prerequisites

- Node.js 18+
- Slack workspace with admin access
- Harvest account
- AWS Bedrock access (for Claude API)

### Environment Variables

Create a `.env` file:

```env
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

# Harvest
HARVEST_TOKEN=...
HARVEST_ACCOUNT_ID=...

# Claude API (via LaunchCode Bedrock Proxy)
LAUNCHCODE_API_KEY=...
LAUNCHCODE_BEDROCK_PROXY_URL=https://...

# Security
ENCRYPTION_KEY=...
```

### Installation

```bash
npm install
npm start
```

### Slack App Configuration

1. Create a new Slack app at [api.slack.com](https://api.slack.com/apps)
2. Enable Socket Mode
3. Add the following slash commands:
   - `/configure`
   - `/reimburse`
   - `/reimburse-transpo`
   - `/reimburse-wellness`
   - `/reimbursement-status`
4. Subscribe to bot events: `file_shared`
5. Install to your workspace

## Usage

### Quick Reimbursement

1. Run `/reimburse-transpo` or `/reimburse-wellness`
2. Upload your receipt image
3. Review the AI-extracted details
4. Click "Submit to Harvest"

### Check Your Balance

Run `/reimbursement-status` to see:
- Current cutoff period (1st or 2nd half of month)
- Transportation usage and remaining balance
- Wellness usage and remaining balance

## Reimbursement Limits

| Category | Limit per Cutoff |
|----------|------------------|
| Transportation | ₱2,500 |
| Health & Wellness | ₱833.33 |

## License

MIT
