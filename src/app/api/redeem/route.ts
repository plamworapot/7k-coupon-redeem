import { NextRequest, NextResponse } from "next/server";

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
      return NextResponse.json({
        success: true,
        message: "Coupon redeemed successfully!",
        reward: data.resultData?.rewardTitle || "Reward sent to mailbox",
      });
    }

    return NextResponse.json({
      success: false,
      message: data.resultMessage || data.errorMessage || "Failed to redeem coupon",
      errorCode: data.errorCode || data.resultCode,
    });
  } catch (error) {
    console.error("Redeem error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while redeeming the coupon" },
      { status: 500 }
    );
  }
}
