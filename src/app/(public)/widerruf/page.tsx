import { CmsPage, cmsMetadata } from "@/components/site/cms-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return cmsMetadata("widerruf");
}

export default function WithdrawalPage() {
  return <CmsPage slug="widerruf" />;
}
