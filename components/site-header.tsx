import Link from "next/link";

const navigation = [
  { href: "/tests/new", label: "New test" },
  { href: "/product", label: "Demo product" },
  { href: "/retrieval", label: "Retrieval" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white text-neutral-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
        <Link className="min-w-0 rounded-sm text-sm font-semibold tracking-[-0.01em]" href="/" aria-label="Trial by User home">
          Trial by User
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="flex items-center gap-0 text-xs text-neutral-600 sm:gap-1 sm:text-sm">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link className="block rounded-md px-2.5 py-2 font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-950 sm:px-3" href={item.href}>
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
