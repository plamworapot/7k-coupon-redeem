# Seven Knights Rebirth - Coupon Auto Redeem

A Next.js web application for automatically redeeming Seven Knights Rebirth game coupons via Netmarble's API.

## Features

- **Auto Tab**: Auto-select and redeem all available coupons with one click
- **Manual Tab**: Enter custom coupon codes (supports multiple codes separated by line, comma, or space)
- **History Tab**: View redemption history per User ID
- **Database Storage**: Coupons stored in PostgreSQL via Prisma
- **Redis Caching**: 1-hour cache for coupon list to reduce DB queries
- **Auto Discovery**: New coupons automatically added to database on successful redemption
- **LocalStorage**: Persists UID and redemption history
- **Mobile Responsive**: Tailwind CSS responsive design

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis instance

### Environment Variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://user:password@host:5432/database"
REDIS_URL="redis://user:password@host:port"
```

### Installation

```bash
npm install
npm run db:push      # Push schema to database
npm run db:seed      # Seed initial coupons
npm run dev          # Start development server
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── coupons/route.ts  # GET/POST coupons from database
│   │   └── redeem/route.ts   # Netmarble coupon redemption
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main UI with tabs
├── lib/
│   ├── prisma.ts             # Prisma client
│   └── redis.ts              # Redis client
prisma/
├── schema.prisma             # Database schema
└── seed.ts                   # Seed script
```

## Database Commands

```bash
npm run db:push      # Push schema changes to database
npm run db:seed      # Seed coupons to database
npm run db:generate  # Generate Prisma client
```

## Response Codes

| Code | Message |
|------|---------|
| 200 | Success |
| 21002 | Invalid User ID |
| 24001 | Rate limited (1 hour) - too many invalid attempts |
| 24002 | Invalid coupon code |
| 24003 | Coupon expired |
| 24004 | Coupon already redeemed |

## GitHub Action - Auto Redeem

The project includes a GitHub Action that automatically discovers and redeems new coupon codes twice daily (00:00 and 12:00 UTC).

### How it works

1. **Fetch Coupons**: Calls Google Gemini API to scrape/discover coupon codes from the internet
2. **Compare**: Checks against existing coupons in the database
3. **Redeem**: Automatically redeems new codes using your configured User ID
4. **Update Database**: Successfully redeemed codes are added to the database

### Required Secrets

Configure these in **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Description |
|--------|-------------|
| `GEMINI_API_KEY` | Your Google AI Studio API key for Gemini |
| `USER_ID` | Your Seven Knights Rebirth User ID (for auto-redemption) |

### Required Variables

Configure these in **Settings → Secrets and variables → Actions → Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_URL` | Your deployed application URL | `https://your-app.vercel.app` |
| `GEMINI_MODEL` | Gemini model to use (optional) | `gemini-2.0-flash-exp` |
| `GEMINI_PROMPT` | Prompt instructing Gemini to find coupon codes | See example below |

### Example GEMINI_PROMPT

```
Search the internet for active Seven Knights Rebirth coupon codes. Look for official social media posts, gaming news sites, and community forums. Return ONLY a JSON array of coupon codes in this exact format: ["CODE1", "CODE2", "CODE3"]. Do not include any explanation or additional text.
```

### Manual Trigger

You can manually trigger the workflow from **Actions → Auto Redeem Coupons → Run workflow**.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma 6
- Redis
- Vercel Analytics

## Development

This project uses [Claude Code](https://claude.ai/claude-code) for AI-assisted development. Project-specific instructions are defined in `CLAUDE.md`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
