import {
  getBillMetadata,
  getStaticBillParams,
  OfficialBillDetailView,
} from "@/features/council-activity/server/components/official-bill-detail-view";

type Props = { params: Promise<{ billId: string }> };
export const generateStaticParams = getStaticBillParams;
export async function generateMetadata({ params }: Props) {
  return getBillMetadata((await params).billId);
}
export default async function BillPage({ params }: Props) {
  return <OfficialBillDetailView billId={(await params).billId} />;
}
