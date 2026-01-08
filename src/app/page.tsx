"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";

interface RedeemResult {
  success: boolean;
  message: string;
  reward?: string;
  errorCode?: number;
}

interface CouponStatus {
  code: string;
  status: "pending" | "loading" | "success" | "error";
  errorCode?: number;
  originalMsg?: string;
  reward?: string;
  timestamp?: number;
}

// Error code to English message mapping
const ERROR_MESSAGES: Record<number, string> = {
  200: "Success",
  21002: "Invalid User ID",
  24001: "Rate limited (1 hour) - too many invalid attempts",
  24002: "Invalid coupon code",
  24003: "Coupon expired",
  24004: "Coupon already redeemed",
};

function getErrorMessage(errorCode?: number, fallback?: string): string {
  if (errorCode && ERROR_MESSAGES[errorCode]) {
    return ERROR_MESSAGES[errorCode];
  }
  return fallback || "Unknown error";
}

interface StoredData {
  uid: string;
  coupons: CouponStatus[];
}


const STORAGE_KEY = "7k_coupon_data";
const UID_STORAGE_KEY = "7k_uid";
const DELAY_MS = 1500;

export default function Home() {
  const { setTheme, resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"auto" | "manual" | "history">("auto");
  const [uid, setUid] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [couponStatuses, setCouponStatuses] = useState<CouponStatus[]>([]);
  const [redeemingTab, setRedeemingTab] = useState<"auto" | "manual" | null>(null);
  const [storedCoupons, setStoredCoupons] = useState<CouponStatus[]>([]);
  const [selectedCoupons, setSelectedCoupons] = useState<Set<string>>(new Set());
  const [hiddenCoupons, setHiddenCoupons] = useState<Set<string>>(new Set());
  const [couponList, setCouponList] = useState<string[]>([]);

  // Fetch coupons from API
  useEffect(() => {
    fetch("/api/coupons")
      .then((res) => res.json())
      .then((data) => {
        if (data.coupons) {
          setCouponList(data.coupons);
        }
      })
      .catch(console.error);
  }, []);

  // Load UID and stored coupons from localStorage on mount
  useEffect(() => {
    const savedUid = localStorage.getItem(UID_STORAGE_KEY);
    if (savedUid) {
      setUid(savedUid);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const allData: Record<string, StoredData> = JSON.parse(stored);
          const uidData = allData[savedUid];
          setStoredCoupons(uidData?.coupons || []);
        } catch {
          setStoredCoupons([]);
        }
      }
    }
    setDataLoaded(true);
  }, []);

  // Save UID to localStorage and load stored coupons when UID changes
  useEffect(() => {
    if (uid) {
      localStorage.setItem(UID_STORAGE_KEY, uid);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const allData: Record<string, StoredData> = JSON.parse(stored);
          const uidData = allData[uid];
          setStoredCoupons(uidData?.coupons || []);
        } catch {
          setStoredCoupons([]);
        }
      } else {
        setStoredCoupons([]);
      }
    }
  }, [uid]);

  // Auto-select all coupons not in history when storedCoupons or couponList change
  useEffect(() => {
    const processedCodes = new Set(storedCoupons.map((c) => c.code));
    const availableCodes = couponList.filter((code) => !processedCodes.has(code));
    setSelectedCoupons(new Set(availableCodes));
  }, [storedCoupons, couponList]);

  const saveCoupons = (uid: string, coupons: CouponStatus[]) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    let allData: Record<string, StoredData> = {};

    if (stored) {
      try {
        allData = JSON.parse(stored);
      } catch {
        allData = {};
      }
    }

    allData[uid] = { uid, coupons };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
    setStoredCoupons(coupons);
  };

  const parseCouponCodes = (input: string): string[] => {
    return input
      .split(/[\n,\s]+/)
      .map((code) => code.trim().toUpperCase())
      .filter((code) => code.length > 0);
  };

  const redeemCoupon = async (code: string): Promise<RedeemResult> => {
    const response = await fetch("/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, couponCode: code }),
    });
    return response.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !couponInput.trim()) return;

    const allCodes = parseCouponCodes(couponInput);
    if (allCodes.length === 0) return;

    setRedeemingTab("manual");
    await processRedemption(allCodes);
  };

  const handleRedeemSelected = async () => {
    if (!uid || selectedCoupons.size === 0) return;

    const codes = Array.from(selectedCoupons);
    setRedeemingTab("auto");
    await processRedemption(codes);
    setSelectedCoupons(new Set());
  };

  const processRedemption = async (allCodes: string[]) => {
    const alreadyProcessed = new Set(storedCoupons.map((c) => c.code));
    const codes = allCodes.filter((code) => !alreadyProcessed.has(code));
    const skippedCodes = allCodes.filter((code) => alreadyProcessed.has(code));

    const skippedStatuses: CouponStatus[] = skippedCodes.map((code) => {
      const existing = storedCoupons.find((c) => c.code === code);
      return {
        code,
        status: existing?.status === "success" ? "success" : "error",
        originalMsg: `Skipped: ${existing?.originalMsg || "Already processed"}`,
      };
    });

    if (codes.length === 0) {
      setCouponStatuses(skippedStatuses);
      return;
    }

    setIsRedeeming(true);

    const initialStatuses: CouponStatus[] = [
      ...skippedStatuses,
      ...codes.map((code) => ({
        code,
        status: "pending" as const,
      })),
    ];
    setCouponStatuses(initialStatuses);

    const skippedCount = skippedStatuses.length;
    const updatedCoupons = [...storedCoupons];

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const statusIdx = skippedCount + i;

      setCouponStatuses((prev) =>
        prev.map((s, idx) => (idx === statusIdx ? { ...s, status: "loading" } : s))
      );

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }

      try {
        const result = await redeemCoupon(code);

        const newStatus: CouponStatus = {
          code,
          status: result.success ? "success" : "error",
          errorCode: result.errorCode,
          originalMsg: result.message,
          reward: result.reward,
          timestamp: Date.now(),
        };

        setCouponStatuses((prev) =>
          prev.map((s, idx) => (idx === statusIdx ? newStatus : s))
        );

        const existingIndex = updatedCoupons.findIndex((c) => c.code === code);
        if (existingIndex >= 0) {
          updatedCoupons[existingIndex] = newStatus;
        } else {
          updatedCoupons.push(newStatus);
        }
        saveCoupons(uid, [...updatedCoupons]);
      } catch {
        const errorStatus: CouponStatus = {
          code,
          status: "error",
          originalMsg: "Network error",
          timestamp: Date.now(),
        };

        setCouponStatuses((prev) =>
          prev.map((s, idx) => (idx === statusIdx ? errorStatus : s))
        );

        const existingIndex = updatedCoupons.findIndex((c) => c.code === code);
        if (existingIndex >= 0) {
          updatedCoupons[existingIndex] = errorStatus;
        } else {
          updatedCoupons.push(errorStatus);
        }
        saveCoupons(uid, [...updatedCoupons]);
      }
    }

    setIsRedeeming(false);
  };

  const clearHistory = () => {
    if (uid) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const allData: Record<string, StoredData> = JSON.parse(stored);
          delete allData[uid];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
        } catch {
          // ignore
        }
      }
      setStoredCoupons([]);
    }
  };

  const deleteCoupon = (codeToDelete: string) => {
    if (!uid) return;
    const newCoupons = storedCoupons.filter((c) => c.code !== codeToDelete);
    saveCoupons(uid, newCoupons);
  };

  const toggleCouponSelection = (code: string) => {
    const newSelected = new Set(selectedCoupons);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedCoupons(newSelected);
  };

  const getCouponStatusInHistory = (code: string) => {
    return storedCoupons.find((c) => c.code === code);
  };

  const historyEntries = [...storedCoupons].sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
  );

  const couponCount = parseCouponCodes(couponInput).length;

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };
  
  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
      <div className="flex flex-col items-center min-h-screen min-h-[100dvh] px-3 py-4 sm:px-4 sm:py-6 md:py-8">
        <div className="w-full max-w-md lg:max-w-lg">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-300/50 dark:border-slate-700/50 overflow-hidden">
            {/* Header */}
            <div className="relative text-center pt-4 sm:pt-6 md:pt-8 px-4 sm:px-6 md:px-8">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
              >
                {resolvedTheme === "dark" ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1 sm:mb-2">
                Seven Knights Rebirth
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">Coupon Auto Redeem</p>
            </div>

            {/* User ID Input - Outside Tabs */}
            <div className="px-4 sm:px-6 md:px-8 mt-4 sm:mt-6">
              <label htmlFor="uid" className="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 sm:mb-2">
                User ID (UID)
              </label>
              <input
                type="text"
                id="uid"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder="Enter your User ID"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-100 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 rounded-lg sm:rounded-xl text-slate-900 dark:text-white text-sm sm:text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                disabled={isRedeeming}
              />
              <p className="mt-1 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                Find your UID in Settings → Account
              </p>
            </div>

            {/* Tabs */}
            <div className="flex mt-4 sm:mt-5 px-4 sm:px-6 md:px-8">
              <button
                onClick={() => setActiveTab("auto")}
                className={`flex-1 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                  activeTab === "auto"
                    ? "bg-slate-200/50 dark:bg-slate-700/50 text-slate-900 dark:text-white border-blue-500"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border-transparent"
                }`}
              >
                Auto
              </button>
              <button
                onClick={() => setActiveTab("manual")}
                className={`flex-1 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                  activeTab === "manual"
                    ? "bg-slate-200/50 dark:bg-slate-700/50 text-slate-900 dark:text-white border-blue-500"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border-transparent"
                }`}
              >
                Manual
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                  activeTab === "history"
                    ? "bg-slate-200/50 dark:bg-slate-700/50 text-slate-900 dark:text-white border-blue-500"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border-transparent"
                }`}
              >
                History
              </button>
            </div>

            <div className="p-4 sm:p-6 md:p-8 pt-4 sm:pt-5 min-h-[200px]">
              {/* Manual Tab */}
              {activeTab === "manual" && (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    <div>
                      <label htmlFor="couponCode" className="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 sm:mb-2">
                        Coupon Codes
                      </label>
                      <textarea
                        id="couponCode"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Enter coupon codes&#10;(one per line, comma, or space)"
                        rows={3}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-100 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 rounded-lg sm:rounded-xl text-slate-900 dark:text-white text-sm sm:text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 uppercase resize-none"
                        required
                        disabled={isRedeeming}
                      />
                      <p className="mt-1 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                        Multiple codes supported: line, comma, or space separated
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isRedeeming || !uid || !couponInput.trim()}
                      className="w-full py-3 sm:py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:shadow-none"
                    >
                      {isRedeeming ? (
                        <>
                          <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Redeeming...</span>
                        </>
                      ) : (
                        <span>Redeem {couponCount > 0 && couponCount} Coupon{couponCount !== 1 ? "s" : ""}</span>
                      )}
                    </button>
                  </form>

                  {/* Redemption Progress */}
                  {couponStatuses.length > 0 && redeemingTab === "manual" && (
                    <div className="mt-5 sm:mt-6">
                      <h3 className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mb-2 sm:mb-3">Redemption Progress</h3>
                      <div className="max-h-48 sm:max-h-60 overflow-y-auto space-y-1.5 sm:space-y-2 scrollbar-thin">
                        {couponStatuses.map((status, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl flex items-center gap-2 sm:gap-3 transition-all duration-300 ${
                              status.status === "success"
                                ? "bg-green-500/10 border border-green-500/30"
                                : status.status === "error"
                                  ? "bg-red-500/10 border border-red-500/30"
                                  : status.status === "loading"
                                    ? "bg-blue-500/10 border border-blue-500/30"
                                    : "bg-slate-200/30 dark:bg-slate-700/30 border border-slate-300/50 dark:border-slate-600/50"
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {status.status === "loading" ? (
                                <svg className="animate-spin h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : status.status === "success" ? (
                                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : status.status === "error" ? (
                                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-slate-400 dark:border-slate-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-mono text-slate-900 dark:text-white truncate">{status.code}</p>
                              {(status.errorCode || status.originalMsg) && (
                                <p className={`text-[10px] sm:text-xs truncate mt-0.5 ${
                                  status.status === "success" ? "text-green-600 dark:text-green-400" :
                                  status.status === "error" ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
                                }`}>
                                  {getErrorMessage(status.errorCode, status.originalMsg)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Auto Tab */}
              {activeTab === "auto" && (
                <div className="space-y-4">
                  {/* Redeem Selected Button */}
                  <button
                    onClick={handleRedeemSelected}
                    disabled={!uid || isRedeeming || selectedCoupons.size === 0}
                    className="w-full py-3 sm:py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:shadow-none"
                  >
                    {!uid ? "Enter UID First" : selectedCoupons.size === 0 ? "All Redeemed" : `Redeem ${selectedCoupons.size} Coupon${selectedCoupons.size !== 1 ? "s" : ""}`}
                  </button>

                  {/* Redemption Progress - Show loading OR last result */}
                  {redeemingTab === "auto" && (() => {
                    const loadingStatus = couponStatuses.find((s) => s.status === "loading");
                    if (loadingStatus) {
                      return (
                        <div className="px-3 py-2 rounded-lg flex items-center gap-2 text-xs sm:text-sm bg-blue-500/10 border border-blue-500/30">
                          <svg className="animate-spin h-4 w-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="font-mono text-slate-900 dark:text-white truncate">{loadingStatus.code}</span>
                          <span className="text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs">Redeeming...</span>
                        </div>
                      );
                    }
                    const lastCompleted = [...couponStatuses].reverse().find((s) => s.status === "success" || s.status === "error");
                    if (lastCompleted) {
                      return (
                        <div className={`px-3 py-2 rounded-lg flex items-center gap-2 text-xs sm:text-sm ${
                          lastCompleted.status === "success"
                            ? "bg-green-500/10 border border-green-500/30"
                            : "bg-red-500/10 border border-red-500/30"
                        }`}>
                          {lastCompleted.status === "success" ? (
                            <svg className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          <span className="font-mono text-slate-900 dark:text-white truncate">{lastCompleted.code}</span>
                          <span className={`truncate text-[10px] sm:text-xs ${
                            lastCompleted.status === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          }`}>
                            {getErrorMessage(lastCompleted.errorCode, lastCompleted.originalMsg)}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Coupon Tags */}
                  {dataLoaded && uid && (
                    <div className="flex flex-wrap gap-2">
                      {couponList.map((code) => {
                        const historyStatus = getCouponStatusInHistory(code);
                        const isSelected = selectedCoupons.has(code);
                        const isJustCompleted = redeemingTab === "auto" && couponStatuses.find((s) => s.code === code && (s.status === "success" || s.status === "error"));

                        if (hiddenCoupons.has(code)) return null;
                        if (historyStatus && !isJustCompleted) return null;

                        return (
                          <button
                            key={code}
                            onClick={() => !historyStatus && toggleCouponSelection(code)}
                            disabled={!!historyStatus}
                            onTransitionEnd={() => {
                              if (isJustCompleted) {
                                setHiddenCoupons((prev) => new Set([...prev, code]));
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-mono transition-all duration-500 ${
                              isJustCompleted
                                ? "opacity-0 scale-95"
                                : isSelected
                                  ? "bg-blue-500 text-white"
                                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                            }`}
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

              {/* History Tab */}
              {activeTab === "history" && (
                <div>
                  {historyEntries.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                          Redemption History
                        </h3>
                        <button
                          onClick={clearHistory}
                          className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 active:text-red-600 dark:active:text-red-500 transition-colors px-2 py-1"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        {historyEntries.map((entry, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl flex items-center gap-2 sm:gap-3 group ${
                              entry.status === "success"
                                ? "bg-green-500/10 border border-green-500/20"
                                : "bg-red-500/10 border border-red-500/20"
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {entry.status === "success" ? (
                                <svg className="w-4 h-4 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-mono text-slate-900 dark:text-white truncate">{entry.code}</p>
                              <p className={`text-[10px] sm:text-xs truncate mt-0.5 ${
                                entry.status === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                              }`}>
                                {getErrorMessage(entry.errorCode, entry.originalMsg)}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteCoupon(entry.code)}
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 sm:opacity-50 sm:hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 active:text-red-600 dark:active:text-red-500 transition-all p-1"
                              title="Delete from history"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-400 dark:text-slate-500 text-sm">No history yet</p>
                      <p className="text-slate-500 dark:text-slate-600 text-xs mt-1">Redeemed coupons will appear here</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-slate-400 dark:text-slate-500 text-[10px] sm:text-xs mt-3 sm:mt-4 px-4">
            <a
              href="https://github.com/plamworapot/7k-coupon-redeem"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
