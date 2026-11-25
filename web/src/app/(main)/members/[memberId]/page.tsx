import {
  getMemberMetadata,
  getStaticMemberParams,
  MemberDetailView,
} from "@/features/council-activity/server/components/member-detail-view";

type Props = { params: Promise<{ memberId: string }> };

export const generateStaticParams = getStaticMemberParams;

export async function generateMetadata({ params }: Props) {
  return getMemberMetadata((await params).memberId);
}

export default async function MemberPage({ params }: Props) {
  return <MemberDetailView memberId={(await params).memberId} />;
}
