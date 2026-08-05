import Link from "next/link";

export default function ProductPageNotFound() {
  return (
    <main className="grid min-h-[calc(100vh-73px)] place-items-center bg-stone-50 px-6 py-20 text-slate-950">
      <div className="max-w-lg text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">FlowPilot knowledge base</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">That page is not in the record.</h1>
        <p className="mt-5 leading-7 text-slate-600">
          This controlled product contains a fixed set of knowledge pages. The address may be incorrect, or the page may not exist.
        </p>
        <Link className="mt-8 inline-block rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800" href="/product">
          Browse all FlowPilot pages
        </Link>
      </div>
    </main>
  );
}
