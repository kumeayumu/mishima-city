import type { ActivityData } from "../types/council-activity";

export function isMemberDataApproved(
  data: Pick<ActivityData, "coverage" | "sources">
) {
  return (
    data.coverage.operatorReview === "approved" &&
    data.sources.every(
      (source) => source.review.operatorReview === "approved"
    ) &&
    (data.coverage.activities.votes !== "partial" ||
      data.coverage.voteIndependentReview === "approved")
  );
}

/** Local previews of pending facts must not silently become a hosted release. */
export function assertMemberPublication(
  data: ActivityData,
  environment: { production: boolean; hosted: boolean; localReview: boolean }
) {
  if (isMemberDataApproved(data)) return;
  if (
    !environment.hosted &&
    (!environment.production || environment.localReview)
  )
    return;
  throw new Error(
    "議員データは運営者確認前です。公開用ビルドは停止しました。ローカル確認のみMISHIMA_LOCAL_REVIEW=1を指定してください。"
  );
}

/** Only the explicit, non-deploying GitHub Actions verification job can review pending facts. */
export function getMemberPublicationEnvironment(
  env: Record<string, string | undefined>
) {
  const ciVerification =
    env.CI === "true" &&
    env.GITHUB_ACTIONS === "true" &&
    env.MISHIMA_CI_VERIFY === "1" &&
    !env.VERCEL;
  return {
    production: env.NODE_ENV === "production",
    hosted: Boolean(env.VERCEL || (env.CI && !ciVerification)),
    localReview: env.MISHIMA_LOCAL_REVIEW === "1" || ciVerification,
  };
}
