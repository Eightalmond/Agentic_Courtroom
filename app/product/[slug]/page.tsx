import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { flowPilotProduct, getProductPage } from "@/lib/product";

type ProductKnowledgePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return flowPilotProduct.pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: ProductKnowledgePageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getProductPage(slug);

  return page
    ? { title: `${page.title} | FlowPilot`, description: page.summary }
    : { title: "Page not found | FlowPilot" };
}

export default async function ProductKnowledgePage({ params }: ProductKnowledgePageProps) {
  const { slug } = await params;
  const page = getProductPage(slug);

  if (!page) {
    notFound();
  }

  const relatedPages = page.relatedSlugs.map((relatedSlug) => getProductPage(relatedSlug)).filter(Boolean);

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4 sm:px-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <li><Link className="rounded font-medium hover:text-amber-700" href="/product">FlowPilot knowledge base</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-slate-700" aria-current="page">{page.title}</li>
            </ol>
          </nav>
        </div>
      </div>

      <article className="mx-auto grid max-w-5xl gap-12 px-6 py-14 sm:px-8 sm:py-18 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <header className="border-b border-slate-200 pb-9">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">{page.category}</p>
            <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">{page.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{page.summary}</p>
          </header>

          {page.callouts?.map((callout) => (
            <aside
              className={`mt-8 rounded-2xl border p-5 ${
                callout.type === "warning"
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-sky-200 bg-sky-50 text-sky-950"
              }`}
              key={callout.title}
            >
              <p className="font-bold">{callout.title}</p>
              <p className="mt-1 text-sm leading-6 opacity-85">{callout.content}</p>
            </aside>
          ))}

          <div className="mt-10 space-y-12">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-2xl font-bold tracking-[-0.02em] text-slate-900">{section.heading}</h2>
                <div className="mt-4 space-y-4 text-base leading-8 text-slate-700">
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
                {section.bullets && (
                  <ul className="mt-5 space-y-3 text-slate-700">
                    {section.bullets.map((bullet) => (
                      <li className="flex gap-3 leading-7" key={bullet}>
                        <span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>

        <aside className="border-t border-slate-200 pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0" aria-labelledby="related-title">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">FlowPilot docs</p>
          <h2 id="related-title" className="mt-3 text-lg font-bold">Related pages</h2>
          <ul className="mt-4 space-y-2">
            {relatedPages.map((relatedPage) => relatedPage && (
              <li key={relatedPage.slug}>
                <Link className="block rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-amber-300 hover:text-amber-800" href={`/product/${relatedPage.slug}`}>
                  {relatedPage.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link className="mt-6 inline-block rounded text-sm font-bold text-amber-700 hover:text-amber-900" href="/product">
            View all knowledge pages
          </Link>
        </aside>
      </article>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-7 text-sm text-slate-500 sm:px-8">
          FlowPilot is a fictional product created for controlled testing.
        </div>
      </footer>
    </main>
  );
}
