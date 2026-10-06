import { CmsPage, cmsMetadata } from "@/components/site/cms-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return cmsMetadata("gratis");
}

export default function FreePage() {
  return <CmsPage slug="gratis" />;
}
