import { describe, expect, it } from "vitest";
import coverage from "../../server/data/2026/coverage.json";
import members from "../../server/data/members.json";
import snapshots from "../../server/data/roster-snapshots.json";
import sources from "../../server/data/sources.json";
import {
  assertMemberPublication,
  getMemberPublicationEnvironment,
  isMemberDataApproved,
} from "./member-publication";
import { parseActivityData } from "./validate-activity-data";

const data = parseActivityData({ members, sources, snapshots, coverage });
// Guard cases require pending facts regardless of the checked-in approval state.
data.coverage.operatorReview = "pending";
for (const source of data.sources) source.review.operatorReview = "pending";
describe("pending member publication guard", () => {
  it("allows pending facts in local development", () => {
    expect(() =>
      assertMemberPublication(data, {
        production: false,
        hosted: false,
        localReview: false,
      })
    ).not.toThrow();
  });
  it("allows an explicit local production review", () => {
    expect(() =>
      assertMemberPublication(data, {
        production: true,
        hosted: false,
        localReview: true,
      })
    ).not.toThrow();
  });
  it("blocks production by default while operator review is pending", () => {
    expect(() =>
      assertMemberPublication(data, {
        production: true,
        hosted: false,
        localReview: false,
      })
    ).toThrow("運営者確認前");
  });
  it("does not allow the local flag to bypass hosted builds", () => {
    expect(() =>
      assertMemberPublication(data, {
        production: true,
        hosted: true,
        localReview: true,
      })
    ).toThrow();
  });
  it("blocks hosted development too", () => {
    expect(() =>
      assertMemberPublication(data, {
        production: false,
        hosted: true,
        localReview: false,
      })
    ).toThrow();
  });
  it("requires all source reviews as well as dataset approval", () => {
    const copy = structuredClone(data);
    copy.coverage.operatorReview = "approved";
    expect(() =>
      assertMemberPublication(copy, {
        production: true,
        hosted: true,
        localReview: false,
      })
    ).toThrow();
  });
  it("allows approved facts without a local review flag", () => {
    const copy = structuredClone(data);
    copy.coverage.operatorReview = "approved";
    for (const s of copy.sources) s.review.operatorReview = "approved";
    expect(() =>
      assertMemberPublication(copy, {
        production: true,
        hosted: true,
        localReview: false,
      })
    ).not.toThrow();
  });
});

describe("non-deploying CI review environment", () => {
  const ci = {
    NODE_ENV: "production",
    CI: "true",
    GITHUB_ACTIONS: "true",
    MISHIMA_CI_VERIFY: "1",
  };
  it("allows an explicitly scoped GitHub Actions verification build", () => {
    expect(() =>
      assertMemberPublication(data, getMemberPublicationEnvironment(ci))
    ).not.toThrow();
  });
  it("blocks normal CI without the verification opt-in", () => {
    expect(() =>
      assertMemberPublication(
        data,
        getMemberPublicationEnvironment({ ...ci, MISHIMA_CI_VERIFY: undefined })
      )
    ).toThrow();
  });
  it("does not treat a lone verification flag as approval", () => {
    expect(() =>
      assertMemberPublication(
        data,
        getMemberPublicationEnvironment({
          NODE_ENV: "production",
          MISHIMA_CI_VERIFY: "1",
        })
      )
    ).toThrow();
  });
  it("rejects a non-GitHub CI pretending to use verification mode", () => {
    expect(() =>
      assertMemberPublication(
        data,
        getMemberPublicationEnvironment({ ...ci, GITHUB_ACTIONS: undefined })
      )
    ).toThrow();
  });
  it("never lets CI verification or local flags bypass Vercel", () => {
    expect(() =>
      assertMemberPublication(
        data,
        getMemberPublicationEnvironment({
          ...ci,
          VERCEL: "1",
          MISHIMA_LOCAL_REVIEW: "1",
        })
      )
    ).toThrow();
  });
});

describe("shared approval status", () => {
  it("reports pending facts as unapproved", () => {
    expect(isMemberDataApproved(data)).toBe(false);
  });
  it("does not report a mixed dataset as approved", () => {
    const copy = structuredClone(data);
    copy.coverage.operatorReview = "approved";
    expect(isMemberDataApproved(copy)).toBe(false);
  });
  it("reports approval only after every source and dataset is approved", () => {
    const copy = structuredClone(data);
    copy.coverage.operatorReview = "approved";
    for (const source of copy.sources)
      source.review.operatorReview = "approved";
    expect(isMemberDataApproved(copy)).toBe(true);
  });
});
