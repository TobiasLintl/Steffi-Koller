import { CmsPage, cmsMetadata } from "@/components/site/cms-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return cmsMetadata("agb");
}

export default function TermsPage() {
  return <CmsPage slug="agb" />;
}
