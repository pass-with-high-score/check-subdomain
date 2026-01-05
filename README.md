# 🔍 Subdomain Scanner

A web-based subdomain enumeration tool that discovers subdomains via **Certificate Transparency logs**, resolves **DNS records**, and detects **Cloudflare protection**.

Built with **Next.js** and styled with **Neo-Brutalism** design.

![Neo-Brutalism Design](https://img.shields.io/badge/Design-Neo--Brutalism-ff00ff?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)

---

## ✨ Features

- **CT Logs Discovery** - Fetches subdomains from crt.sh Certificate Transparency logs
- **DNS Resolution** - Resolves A records with 50 concurrent lookups
- **Cloudflare Detection** - Identifies subdomains behind Cloudflare using IP CIDR matching
- **Sortable & Filterable** - Sort by subdomain, IP, or Cloudflare status
- **Export JSON** - Download complete scan results
- **Copy to Clipboard** - One-click copy with toast notifications

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/pass-with-high-score/check-subdomain.git
cd check-subdomain

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/scan/route.ts    # API endpoint
│   ├── page.tsx             # Main page
│   ├── page.module.css      # Page styles
│   └── globals.css          # Global styles
├── lib/
│   ├── cloudflare.ts        # Cloudflare IP detection
│   ├── crtsh.ts             # CT logs fetcher
│   └── dns-resolver.ts      # DNS resolution
└── components/
    ├── SubdomainTable.tsx   # Results table
    ├── Toast.tsx            # Toast notifications
    └── *.module.css         # Component styles
```

---

## 🎨 Design

This project uses **Neo-Brutalism** design style:

- **Typography**: Lexend Mega (bold, chunky)
- **Colors**: Neon Yellow, Pink, Cyan, Green, Orange
- **Borders**: 4px thick black
- **Shadows**: Hard 6-8px (no blur)
- **Corners**: Sharp 0px (no border-radius)

---

## 🔧 API Usage

### `POST /api/scan`

**Request:**
```json
{
  "domain": "example.com"
}
```

**Response:**
```json
{
  "scan_date": "2026-01-05 08:50:00",
  "domain": "example.com",
  "stats": {
    "total": 87,
    "cloudflare": 42,
    "no_ip": 30
  },
  "subdomains": [
    {
      "subdomain": "www.example.com",
      "ip": "104.16.1.1",
      "cloudflare": true
    }
  ]
}
```

---

## 📜 License

MIT License - feel free to use this project for any purpose.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
