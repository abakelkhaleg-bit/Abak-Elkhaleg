"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * قائمة منسدلة مبنية على <details> (تعمل بدون JavaScript)، تُغلق تلقائيًا عند الانتقال
 * لصفحة أخرى أو عند الضغط خارجها أو Escape.
 */
export function NavDisclosure({
  summary,
  summaryClassName,
  panelClassName,
  className,
  children,
}: {
  summary: React.ReactNode;
  summaryClassName?: string;
  panelClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      <summary className={summaryClassName}>{summary}</summary>
      <div className={panelClassName}>{children}</div>
    </details>
  );
}
