import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getPublicStoreSettings } from "@/server/settings.service";

/**
 * Footer المتجر: الهوية، وروابط التسوق، والسياسات، والتواصل — كلها من إعدادات المتجر.
 * الشعار غير شفاف، لذلك يوضع داخل إطار كريمي على الخلفية الداكنة (PROJECT_PLAN §5).
 */
export async function SiteFooter() {
  const settings = await getPublicStoreSettings();
  const { logo } = siteConfig.brandAssets;
  const year = new Date().getFullYear();
  const headingClass = "mb-3 text-sm font-bold text-gold-light";
  const linkClass = "text-sm text-cream/85 transition-colors hover:text-ivory hover:underline";
  const { contact } = settings;
  const hasContact = Boolean(
    contact.phone || contact.email || contact.address || contact.workingHours,
  );

  return (
    <footer className="mt-auto bg-espresso text-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="flex flex-col gap-4">
          <div className="w-fit rounded-lg bg-ivory px-5 py-2.5 shadow-soft ring-1 ring-gold/40">
            <Image
              src={logo.src}
              alt={settings.storeName}
              width={logo.width}
              height={logo.height}
              sizes="140px"
              className="h-11 w-auto"
            />
          </div>
          <p className="text-sm leading-7 text-cream/85">{settings.description}</p>
        </div>

        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className={headingClass}>
            تسوّق
          </h2>
          <ul className="flex flex-col gap-2">
            <li>
              <Link href="/perfumes" className={linkClass}>
                جميع العطور
              </Link>
            </li>
            <li>
              <Link href="/offers" className={linkClass}>
                العروض
              </Link>
            </li>
            <li>
              <Link href="/brands" className={linkClass}>
                الماركات
              </Link>
            </li>
            <li>
              <Link href="/cart" className={linkClass}>
                السلة
              </Link>
            </li>
          </ul>
        </nav>

        {settings.policies.length > 0 ? (
          <nav aria-labelledby="footer-policies">
            <h2 id="footer-policies" className={headingClass}>
              السياسات
            </h2>
            <ul className="flex flex-col gap-2">
              {settings.policies.map((policy) => (
                <li key={policy.slug}>
                  <Link href={`/policies/${policy.slug}`} className={linkClass}>
                    {policy.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {hasContact || settings.socialLinks.length > 0 ? (
          <div>
            <h2 className={headingClass}>تواصل معنا</h2>
            <ul className="flex flex-col gap-2 text-sm text-cream/85">
              {contact.phone ? (
                <li>
                  الهاتف: <bdi dir="ltr">{contact.phone}</bdi>
                </li>
              ) : null}
              {contact.email ? (
                <li>
                  البريد:{" "}
                  <a href={`mailto:${contact.email}`} className={linkClass}>
                    <bdi dir="ltr">{contact.email}</bdi>
                  </a>
                </li>
              ) : null}
              {contact.address ? <li>{contact.address}</li> : null}
              {contact.workingHours ? <li>{contact.workingHours}</li> : null}
            </ul>
            {settings.socialLinks.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-3">
                {settings.socialLinks.map((social) => (
                  <li key={social.key}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="border-t border-cream/15 px-4 py-5 text-center text-xs text-cream/70">
        © <bdi>{year}</bdi> {settings.storeName}. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
