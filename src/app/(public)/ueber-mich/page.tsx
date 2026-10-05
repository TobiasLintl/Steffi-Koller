import { CmsPage, cmsMetadata } from "@/components/site/cms-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return cmsMetadata("ueber-mich");
}

export default function AboutPage() {
  return <CmsPage slug="ueber-mich" />;
}
