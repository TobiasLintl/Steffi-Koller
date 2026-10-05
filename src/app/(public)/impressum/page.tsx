import { CmsPage, cmsMetadata } from "@/components/site/cms-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return cmsMetadata("impressum");
}

export default function ImprintPage() {
  return <CmsPage slug="impressum" />;
}
