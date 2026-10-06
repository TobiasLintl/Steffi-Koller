import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { coupons } from "@/server/db/schema";

type Coupon = typeof coupons.$inferSelect;

function dateValue(d: Date | null | undefined) {
  return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
}

export function CouponFields({
  coupon,
  products,
}: {
  coupon?: Coupon;
  products: { id: string; title: string }[];
}) {
  const p = coupon?.id ?? "new";
  const value = coupon
    ? coupon.discountType === "percent"
      ? String(coupon.discountValue)
      : (coupon.discountValue / 100).toFixed(2).replace(".", ",")
    : "";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <FormField id={`code-${p}`} label="Code">
          <Input id={`code-${p}`} name="code" defaultValue={coupon?.code} required />
        </FormField>
        <FormField id={`type-${p}`} label="Art">
          <Select
            id={`type-${p}`}
            name="discountType"
            defaultValue={coupon?.discountType ?? "percent"}
          >
            <option value="percent">Prozent</option>
            <option value="amount">Betrag</option>
          </Select>
        </FormField>
        <FormField id={`value-${p}`} label="Wert">
          <Input
            id={`value-${p}`}
            name="discountValue"
            inputMode="decimal"
            defaultValue={value}
            required
          />
        </FormField>
        <FormField id={`cur-${p}`} label="Währung (bei Betrag)">
          <Select id={`cur-${p}`} name="currency" defaultValue={coupon?.currency ?? ""}>
            <option value="">–</option>
            <option value="EUR">EUR</option>
            <option value="CHF">CHF</option>
          </Select>
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id={`from-${p}`} label="Gültig ab">
          <Input
            id={`from-${p}`}
            name="validFrom"
            type="datetime-local"
            defaultValue={dateValue(coupon?.validFrom)}
          />
        </FormField>
        <FormField id={`until-${p}`} label="Gültig bis">
          <Input
            id={`until-${p}`}
            name="validUntil"
            type="datetime-local"
            defaultValue={dateValue(coupon?.validUntil)}
          />
        </FormField>
        <FormField id={`ref-${p}`} label="Referenz beim Reseller">
          <Input
            id={`ref-${p}`}
            name="providerReference"
            defaultValue={coupon?.providerReference ?? ""}
          />
        </FormField>
      </div>
      <FormField id={`desc-${p}`} label="Interne Beschreibung">
        <Input id={`desc-${p}`} name="description" defaultValue={coupon?.description} />
      </FormField>
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1 font-medium">Gilt für (keine Auswahl = alle Produkte)</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {products.map((prod) => (
            <label key={prod.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="productIds"
                value={prod.id}
                defaultChecked={coupon?.productIds.includes(prod.id)}
                className="size-4"
              />
              {prod.title}
            </label>
          ))}
        </div>
      </fieldset>
      <FormField
        id={`notice-${p}`}
        label="Hinweis auf der Website"
        hint="z. B. „Nur bis Sonntag: 10 % mit dem Code SOMMER10“"
      >
        <Input id={`notice-${p}`} name="websiteNotice" defaultValue={coupon?.websiteNotice} />
      </FormField>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="showOnWebsite"
            defaultChecked={coupon?.showOnWebsite ?? false}
            className="size-4"
          />{" "}
          auf Produktseiten anzeigen
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={coupon?.isActive ?? true}
            className="size-4"
          />{" "}
          aktiv
        </label>
      </div>
    </>
  );
}
