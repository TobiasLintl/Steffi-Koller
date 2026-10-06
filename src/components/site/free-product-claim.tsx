import { claimFreeProductAction } from "@/app/(public)/gratis/actions";
import { Button } from "@/components/ui/button";

export function FreeProductClaim({ productId }: { productId: string }) {
  return (
    <form action={claimFreeProductAction.bind(null, productId)}>
      <Button type="submit">Kostenlos freischalten</Button>
    </form>
  );
}
