import Link from "next/link";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/product", label: "Demo product" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 sm:px-8 lg:px-10">
        <Link className="flex min-w-0 items-center gap-3 rounded-lg" href="/" aria-label="Trial by User home">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-amber-300/30 bg-amber-300/10 font-serif text-lg font-bold text-amber-300">
            T
          </span>
          <span className="truncate text-sm font-semibold tracking-[0.08em]">TRIAL BY USER</span>
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="flex items-center gap-1 text-sm text-slate-300 sm:gap-3">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link className="block rounded-lg px-3 py-2 font-medium transition-colors hover:bg-white/10 hover:text-white" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
