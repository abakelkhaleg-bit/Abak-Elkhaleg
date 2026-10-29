import { cn } from "@/lib/cn";
import { discountPercent, formatEGP } from "@/lib/money";

const arabicNumber = new Intl.NumberFormat("ar-EG");

/** عرض السعر بالجنيه مع السعر قبل الخصم ونسبته. يعمل في Server وClient Components. */
export function PriceTag({
  price,
  compareAtPrice,
  startingFrom = false,
  size = "md",
  className,
}: {
  price: number;
  compareAtPrice?: number | null;
  startingFrom?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const percent = discountPercent(price, compareAtPrice);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      {startingFrom ? <span className="text-xs text-muted">يبدأ من</span> : null}
      <span
        className={cn("font-bold text-espresso", size === "lg" ? "text-2xl" : "text-base")}
        data-testid="price"
      >
        {formatEGP(price)}
      </span>
      {percent !== null && compareAtPrice ? (
        <>
          <s className="text-sm text-muted">
            <span className="sr-only">السعر قبل الخصم </span>
            {formatEGP(compareAtPrice)}
          </s>
          <span className="rounded-sm bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger">
            خصم {arabicNumber.format(percent)}٪
          </span>
        </>
      ) : null}
    </div>
  );
}
