import { CmsPage, cmsMetadata } from "@/components/site/cms-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return cmsMetadata("datenschutz");
}

export default function PrivacyPage() {
  return <CmsPage slug="datenschutz" />;
}
