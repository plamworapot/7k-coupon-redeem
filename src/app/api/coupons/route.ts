import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";
import { NextResponse } from "next/server";

const CACHE_KEY = "coupons:active";
const CACHE_TTL = 60 * 60; // 1 hour

export async function GET() {
  try {
    const redis = await getRedisClient();

    // Try to get from cache
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return NextResponse.json({
        coupons: JSON.parse(cached),
      });
    }

    // Fetch from database
    const coupons = await prisma.coupon.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      select: { code: true },
    });

    const couponCodes = coupons.map((c) => c.code);

    // Cache the result
    await redis.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(couponCodes));

    return NextResponse.json({
      coupons: couponCodes,
    });
  } catch (error) {
    console.error("Failed to fetch coupons:", error);
    return NextResponse.json(
      { error: "Failed to fetch coupons" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Invalid coupon code" },
        { status: 400 }
      );
    }

    const coupon = await prisma.coupon.create({
      data: { code: code.toUpperCase() },
    });

    // Invalidate cache
    const redis = await getRedisClient();
    await redis.del(CACHE_KEY);

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error("Failed to create coupon:", error);
    return NextResponse.json(
      { error: "Failed to create coupon" },
      { status: 500 }
    );
  }
}
