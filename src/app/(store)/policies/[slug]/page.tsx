import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { excerpt, pageMetadata } from "@/lib/seo";
import { getPolicyBySlug } from "@/server/settings.service";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const policy = await getPolicyBySlug(slug);
  if (!policy) return { title: "الصفحة غير موجودة", robots: { index: false } };
  return pageMetadata({
    title: policy.title,
    description: excerpt(policy.body),
    path: `/policies/${slug}`,
  });
}

export default async function PolicyPage({ params }: Props) {
  const slug = decodeURIComponent((await params).slug);
  const policy = await getPolicyBySlug(slug);
  if (!policy) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ label: "الرئيسية", href: "/" }, { label: policy.title }]} />
      <h1 className="text-3xl">{policy.title}</h1>
      <div className="flex flex-col gap-4 leading-8 text-charcoal">
        {policy.body
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
      </div>
    </div>
  );
}
