import "server-only";
import archive from "@/features/official-records/server/data/2026/bills.json";
import { getVoteBills, parseVoteData } from "../../shared/utils/vote-data";
import references from "../data/2026/bill-references.json";
import votes from "../data/2026/member-votes.json";
import resultChecks from "../data/2026/result-checks.json";
import affiliations from "../data/2026/vote-affiliations.json";
import cellEvidence from "../data/2026/vote-cell-evidence.json";
import verification from "../data/2026/vote-verifications.json";
import events from "../data/2026/voting-events.json";
import { getCouncilActivity } from "./council-activity-repository";

const data = parseVoteData(
  {
    references,
    events,
    votes,
    affiliations,
    verification,
    resultChecks,
    cellEvidence,
  },
  getCouncilActivity(),
  archive
);
export function getCouncilVotes() {
  return { data, bills: getVoteBills(data, archive) };
}
