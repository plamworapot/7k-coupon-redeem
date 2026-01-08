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
| 24002 | Invalid coupon code |
| 24003 | Coupon expired |
| 24004 | Coupon already redeemed |

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
