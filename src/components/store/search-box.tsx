"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { name: string; slug: string; brandName: string | null };

/**
 * حقل البحث في الـHeader: نموذج GET إلى /search (يعمل بدون JavaScript)،
 * مع اقتراحات من الخادم بعد حرفين على الأقل.
 */
export function SearchBox({ idPrefix }: { idPrefix: string }) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { suggestions?: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } catch {
        // الاقتراحات تحسين اختياري؛ البحث الكامل يبقى متاحًا عبر زر البحث.
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const showList = open && query.trim().length >= 2 && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <form action="/search" method="get" role="search" className="flex items-center">
        <label htmlFor={`${idPrefix}-search`} className="sr-only">
          ابحث عن عطر أو ماركة
        </label>
        <input
          id={`${idPrefix}-search`}
          name="q"
          type="search"
          value={query}
          maxLength={64}
          autoComplete="off"
          placeholder="ابحث عن عطر أو ماركة…"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim().length < 2) setSuggestions([]);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className="w-full rounded-full border border-sand bg-white py-2.5 pe-11 ps-4 text-sm focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          aria-label="بحث"
          className="absolute end-1 inline-flex size-9 items-center justify-center rounded-full text-espresso hover:bg-cream"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4.2-4.2" strokeLinecap="round" />
          </svg>
        </button>
      </form>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="اقتراحات البحث"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg bg-white shadow-lifted ring-1 ring-sand"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.slug} role="option" aria-selected="false">
              <Link
                href={`/perfumes/${suggestion.slug}`}
                onClick={() => setOpen(false)}
                className="flex flex-col px-4 py-2.5 text-sm hover:bg-cream focus:bg-cream focus:outline-none"
              >
                <span className="font-medium text-charcoal">{suggestion.name}</span>
                {suggestion.brandName ? (
                  <span className="text-xs text-gold-text">{suggestion.brandName}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
