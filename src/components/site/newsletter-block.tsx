import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function NewsletterBlock({ heading, body }: { heading: React.ReactNode; body: string }) {
  return (
    <section className="my-6 flex flex-col gap-3 rounded-2xl border p-6 sm:p-8">
      {heading}
      {body ? <p className="text-muted-foreground">{body}</p> : null}
      <div>
        <Link href="/newsletter" className={buttonVariants({ variant: "outline" })}>
          Zum Newsletter
        </Link>
      </div>
    </section>
  );
}
