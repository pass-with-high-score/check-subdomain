# DevTools

Free online developer tools. No signup required, 100% client-side processing for most tools.

**Live Demo**: [pwhs.app](https://pwhs.app)

## Tools

| Tool | Description | Storage |
|------|-------------|---------|
| **Subdomain Scanner** | Discover subdomains using CT logs, VirusTotal, Shodan | Client-side |
| **OTP Generator** | Generate TOTP codes with key saving and password protection | Local Storage |
| **Base64 Image** | View/encode images to Base64 with drag & drop | Client-side |
| **Webhook Tester** | Receive and inspect webhook requests in real-time | Server |
| **JSON Server** | Host, validate, and share JSON data with mock APIs | Server |
| **Image Uploader** | Upload images and get shareable links | S3/R2 |
| **File Transfer** | Share any file with expiring download links | S3/R2 |
| **Time Capsule** | Lock files until a future date | S3/R2 |
| **Speech to Text** | Transcribe audio with word-level timestamps and seek | Server (Deepgram) |
| **ANeko Builder** | Create custom skins for ANeko Reborn Android app | Client-side |
| **Anonymous Chat** | Real-time public chat with random usernames | PostgreSQL |

## Project Structure

```
devtool-fe/
├── src/                    # Next.js frontend
│   ├── app/               # App router pages
│   ├── components/        # React components (incl. ChatWidget)
│   └── lib/               # Utilities
├── backend/               # NestJS backend API
│   └── src/
│       ├── chat/          # WebSocket chat gateway
│       ├── cleanup/       # Scheduled cleanup tasks
│       ├── database/      # Database service
│       └── storage/       # S3/R2 storage service
```

## Quick Start

### Frontend (Next.js)

```bash
# Install dependencies
bun install

# Run development server
bun run dev
```

Open http://localhost:3000

### Backend (NestJS)

```bash
cd backend

# Install dependencies
bun install

# Run development server
bun run start:dev
```

Backend runs on http://localhost:3001

## Environment Variables

### Frontend (.env)

```env
# VirusTotal API Key (free tier: 4 requests/minute)
VIRUSTOTAL_API_KEY=

# Shodan API Key (free tier: 100 credits/month)
SHODAN_API_KEY=

# Base URL
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# PostgreSQL Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# S3/R2 Cloudflare Storage
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_PUBLIC_URL=

# Custom Public URLs (optional)
IMAGE_PUBLIC_URL=https://image.yourdomain.com
CAPSULE_PUBLIC_URL=https://capsule.yourdomain.com

# Time Capsule Settings (optional)
CAPSULE_MAX_FILE_SIZE=104857600
CAPSULE_MAX_LOCK_DAYS=365
CAPSULE_MIN_LOCK_DAYS=1
```

### Backend (.env)

```env
# PostgreSQL Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# S3/R2 Storage
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=

# Deepgram API Key (for Speech to Text)
DEEPGRAM_API_KEY=

# Server Port
PORT=3001
```

## API Keys (Optional)

Configure in UI Settings panel:
- **VirusTotal** - [virustotal.com](https://www.virustotal.com/) - Subdomain enumeration
- **Shodan** - [shodan.io](https://shodan.io/) - Subdomain enumeration

##  Deployment

### Frontend
Deploy to any platform that supports Next.js (Vercel, Netlify, etc.)

### Backend
```bash
cd backend
bun run build
bun run start:prod
```

Or use PM2:
```bash
pm2 start ecosystem.config.js
```

## License

MIT
