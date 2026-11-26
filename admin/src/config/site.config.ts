/**
 * サイト設定ファイル（Admin）
 * Fork して別の地方議会向けに使用する場合はこのファイルを変更してください。
 */
export const siteConfig = {
  siteName: "みらい議会ー三島市版",
  cityName: "三島市",
  councilName: "三島市議会",
  councilBaseUrl: "https://www.city.mishima.shizuoka.jp/site/gikai/",
  councilBillsDetailUrl:
    "https://www.city.mishima.shizuoka.jp/site/gikai/list216-519.html",
  councilFactionExamples: "三島市議会公式の会派別名簿を確認して入力",
} as const;
