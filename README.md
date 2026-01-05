# Subdomain Scanner

A comprehensive subdomain enumeration tool that aggregates data from multiple sources to discover, resolve, and analyze subdomains.

## Features

- **Multi-Source Discovery**
  - **Certificate Transparency Logs**: Fetches historical data from crt.sh
  - **VirusTotal**: Passive DNS lookup (API key integration)
  - **Shodan**: Subdomain discovery and host information
  - **Subfinder**: Integration with ProjectDiscovery's CLI tool
- **Deep Analysis**
  - **DNS Resolution**: High-concurrency A record resolution
  - **Cloudflare Detection**: Identifies protection status via IP CIDR
  - **Port Scanning**: Passive port detection via Shodan
- **Professional UI**
  - **Neo-Brutalism Design**: High-contrast, bold aesthetics
  - **Interactive Table**: Sortable, filterable columns
  - **Export Capabilities**: JSON export for external processing

## Quick Start

### Prerequisites

- Node.js 18+
- Go (optional, for Subfinder)

### Installation

```bash
git clone https://github.com/pass-with-high-score/check-subdomain.git
cd check-subdomain
npm install
```

### Setup Subfinder (Optional)

To enable the Subfinder integration, install the CLI tool:

```bash
# Using Go (Recommended)
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# Using Homebrew (macOS)
brew install subfinder
```

### Running the Application

```bash
npm run dev
# Server starting at http://localhost:3000
```

## API Configuration

To unlock full capabilities, configure your API keys in the UI Settings panel:

1. **VirusTotal Key**: Get free key from [virustotal.com](https://www.virustotal.com/)
2. **Shodan Key**: Get free key from [shodan.io](https://shodan.io/)

The application works fully without keys, relying on CT logs and Subfinder (if installed).

## API Reference

### Endpoint: `POST /api/scan`

**Request Body**
```json
{
  "domain": "example.com",
  "virustotalApiKey": "optional_key",
  "shodanApiKey": "optional_key",
  "enableSubfinder": true
}
```

**Response**
```json
{
  "scan_date": "2026-01-05 10:00:00",
  "domain": "example.com",
  "stats": {
    "total": 150,
    "cloudflare": 45,
    "sources": {
      "crtsh": 120,
      "virustotal": 80,
      "subfinder": 100
    }
  },
  "subdomains": [
    {
      "subdomain": "admin.example.com",
      "ip": "1.2.3.4",
      "cloudflare": false,
      "ports": [80, 443],
      "source": ["crtsh", "virustotal"]
    }
  ]
}
```

## License

MIT License
