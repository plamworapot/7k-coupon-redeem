# Seven Knights Rebirth - Coupon Auto Redeem

A Next.js web application for automatically redeeming Seven Knights Rebirth game coupons via Netmarble's API.

## Features

- **Auto Tab**: Auto-select and redeem all available coupons with one click
- **Manual Tab**: Enter custom coupon codes (supports multiple codes separated by line, comma, or space)
- **History Tab**: View redemption history per User ID
- **LocalStorage**: Persists UID and redemption history
- **Mobile Responsive**: Tailwind CSS responsive design

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

```
src/
├── app/
│   ├── api/redeem/route.ts   # API route for Netmarble coupon redemption
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main UI with tabs
└── data/
    └── coupons.json          # List of available coupon codes
```

## Adding New Coupons

Edit `src/data/coupons.json` to add or remove coupon codes:

```json
{
  "coupons": [
    "COUPONCODE1",
    "COUPONCODE2"
  ]
}
```

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
