import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { Badge, buttonClass, Card, PageHeader } from "@/components/admin/ui";
import { deleteTaxonomyAction, setTaxonomyActiveAction } from "@/features/catalog/actions";
import { listTaxonomyForAdmin, type TaxonomyKind } from "@/server/admin/taxonomy.admin.service";

const COPY = {
  category: {
    title: "التصنيفات",
    noun: "التصنيف",
    base: "/admin/categories",
    add: "إضافة تصنيف",
    publicBase: "/categories",
  },
  brand: {
    title: "الماركات",
    noun: "الماركة",
    base: "/admin/brands",
    add: "إضافة ماركة",
    publicBase: "/brands",
  },
} as const;

const arabicNumber = new Intl.NumberFormat("ar-EG");

/** قائمة التصنيفات/الماركات في الإدارة (Server Component). */
export async function TaxonomyList({ kind }: { kind: TaxonomyKind }) {
  const copy = COPY[kind];
  const rows = await listTaxonomyForAdmin(kind);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={copy.title}
        description="الحذف متاح فقط عند عدم ارتباط منتجات؛ الإخفاء متاح دائمًا."
        action={{ href: `${copy.base}/new`, label: copy.add }}
      />
      {rows.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-muted">لا توجد عناصر بعد.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} data-testid="taxonomy-row">
              <Card className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`${copy.base}/${row.id}`} className="font-bold hover:underline">
                      {row.name}
                    </Link>
                    {row.isActive ? <Badge tone="success">ظاهر</Badge> : <Badge>مخفي</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    <bdi dir="ltr">{row.slug}</bdi> · {arabicNumber.format(row.productCount)} منتج ·
                    ترتيب {arabicNumber.format(row.sortOrder)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`${copy.base}/${row.id}`} className={buttonClass.secondary}>
                    تعديل
                  </Link>
                  <ActionButton
                    action={setTaxonomyActiveAction.bind(null, kind, row.id, !row.isActive)}
                    label={row.isActive ? "إخفاء" : "إظهار"}
                    successMessage={row.isActive ? `أُخفي ${copy.noun}.` : `أصبح ${copy.noun} ظاهرًا.`}
                  />
                  <ActionButton
                    action={deleteTaxonomyAction.bind(null, kind, row.id)}
                    label="حذف"
                    variant="danger"
                    confirmText={`سيُحذف «${row.name}» نهائيًا. لن يُسمح بالحذف إن كانت هناك منتجات مرتبطة به.`}
                    successMessage={`حُذف ${copy.noun}.`}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
