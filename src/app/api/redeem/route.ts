import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";

const CACHE_KEY = "coupons:active";

interface RedeemRequest {
  uid: string;
  couponCode: string;
}

interface NetmarbleResponse {
  resultCode: string;
  resultMessage?: string;
  resultData?: {
    rewardTitle?: string;
  };
  errorCode?: string;
  errorMessage?: string;
}

// Error code to English message mapping
const ERROR_MESSAGES: Record<string, string> = {
  "21002": "Invalid User ID",
  "24002": "Invalid coupon code",
  "24003": "Coupon expired",
  "24004": "Coupon already redeemed",
};

function getErrorMessage(errorCode?: string, fallback?: string): string {
  if (errorCode && ERROR_MESSAGES[errorCode]) {
    return ERROR_MESSAGES[errorCode];
  }
  return fallback || "Failed to redeem coupon";
}

async function isCouponInCache(code: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      const coupons: string[] = JSON.parse(cached);
      return coupons.includes(code.toUpperCase());
    }
  } catch {
    // Ignore cache errors
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body: RedeemRequest = await request.json();

    if (!body.uid || !body.couponCode) {
      return NextResponse.json(
        { success: false, message: "User ID and Coupon Code are required" },
        { status: 400 }
      );
    }

    const payload = {
      pid: body.uid,
      couponCode: body.couponCode,
      gameCode: "tskgb",
      channelCode: 100,
      langCd: "en",
    };

    const response = await fetch("https://coupon.netmarble.com/api/coupon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Origin: "https://coupon.netmarble.com",
        Referer: "https://coupon.netmarble.com/tskgb",
      },
      body: JSON.stringify(payload),
    });

    const data: NetmarbleResponse = await response.json();

    if (data.resultCode === "200" || data.resultCode === "0") {
      // Upsert coupon to database on successful redemption (skip if already in cache)
      const inCache = await isCouponInCache(body.couponCode);
      if (!inCache) {
        try {
          await prisma.coupon.upsert({
            where: { code: body.couponCode.toUpperCase() },
            update: {},
            create: { code: body.couponCode.toUpperCase() },
          });
          const redis = await getRedisClient();
          await redis.del(CACHE_KEY);
        } catch (dbError) {
          console.error("Failed to upsert coupon:", dbError);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Coupon redeemed successfully!",
        reward: data.resultData?.rewardTitle || "Reward sent to mailbox",
      });
    }

    const errorCode = data.errorCode || data.resultCode;

    // Upsert coupon if already redeemed (valid coupon) - skip if already in cache
    if (errorCode === "24004") {
      const inCache = await isCouponInCache(body.couponCode);
      if (!inCache) {
        try {
          await prisma.coupon.upsert({
            where: { code: body.couponCode.toUpperCase() },
            update: {},
            create: { code: body.couponCode.toUpperCase() },
          });
          const redis = await getRedisClient();
          await redis.del(CACHE_KEY);
        } catch (dbError) {
          console.error("Failed to upsert coupon:", dbError);
        }
      }
    }

    // Mark coupon as expired in database
    if (errorCode === "24003") {
      try {
        await prisma.coupon.update({
          where: { code: body.couponCode.toUpperCase() },
          data: { active: false },
        });
        const redis = await getRedisClient();
        await redis.del(CACHE_KEY);
      } catch (dbError) {
        console.error("Failed to update expired coupon:", dbError);
      }
    }

    return NextResponse.json({
      success: false,
      message: getErrorMessage(errorCode, data.resultMessage || data.errorMessage),
      errorCode,
    });
  } catch (error) {
    console.error("Redeem error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while redeeming the coupon" },
      { status: 500 }
    );
  }
}
