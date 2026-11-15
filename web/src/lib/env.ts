/**
 * 環境変数の設定
 * アプリケーション全体で使用する環境変数を一元管理
 */

const chatDailyCostLimitUsdRaw = process.env.CHAT_DAILY_COST_LIMIT_USD || "0.5";

const chatDailyCostLimitUsd = Number(chatDailyCostLimitUsdRaw);

if (Number.isNaN(chatDailyCostLimitUsd) || chatDailyCostLimitUsd <= 0) {
  throw new Error(
    "環境変数 CHAT_DAILY_COST_LIMIT_USD は正の数値で指定してください"
  );
}

export const env = {
  webUrl: process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3002",
  adminUrl: process.env.ADMIN_URL || "http://localhost:3001",
  get supabaseUrl() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!value)
      throw new Error("DB機能には NEXT_PUBLIC_SUPABASE_URL が必要です");
    return value;
  },
  get supabaseAnonKey() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!value)
      throw new Error("DB機能には NEXT_PUBLIC_SUPABASE_ANON_KEY が必要です");
    return value;
  },
  revalidateSecret: process.env.REVALIDATE_SECRET,
  analytics: {
    gaTrackingId: process.env.NEXT_PUBLIC_GA_TRACKING_ID,
  },
  langfuse: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
    promptLabel: process.env.LANGFUSE_PROMPT_LABEL || "production",
  },
  chat: {
    dailyCostLimitUsd: chatDailyCostLimitUsd,
  },
} as const;

// 型定義
export type Env = typeof env;
