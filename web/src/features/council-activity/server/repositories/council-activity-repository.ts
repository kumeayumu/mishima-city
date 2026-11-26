import "server-only";
import {
  assertMemberPublication,
  getMemberPublicationEnvironment,
} from "../../shared/utils/member-publication";
import { parseActivityData } from "../../shared/utils/validate-activity-data";
import coverage from "../data/2026/coverage.json";
import members from "../data/members.json";
import snapshots from "../data/roster-snapshots.json";
import sources from "../data/sources.json";

const data = parseActivityData({ members, snapshots, sources, coverage });

assertMemberPublication(data, getMemberPublicationEnvironment(process.env));

export function getCouncilActivity() {
  return data;
}
