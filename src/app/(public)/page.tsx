import { CmsPage, cmsMetadata } from "@/components/site/cms-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return cmsMetadata("start");
}

export default function HomePage() {
  return <CmsPage slug="start" />;
}
