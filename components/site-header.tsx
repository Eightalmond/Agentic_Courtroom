import Link from "next/link";

const navigation = [
  { href: "/tests/new", label: "New test" },
  { href: "/product", label: "Demo product" },
  { href: "/retrieval", label: "Retrieval" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-lab-border bg-lab-surface text-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-8 lg:px-10">
        <Link className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-sm text-xs font-semibold tracking-[-0.01em] sm:text-sm" href="/" aria-label="Trial by User home">
          <span className="size-2 rounded-sm bg-lab-accent" aria-hidden="true" />
          <span>Trial by User</span>
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="flex items-center gap-0 text-[0.68rem] text-lab-muted sm:gap-1 sm:text-sm">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link className="block whitespace-nowrap rounded-md px-1.5 py-2 font-medium transition-colors hover:bg-lab-accent-soft hover:text-lab-accent sm:px-3" href={item.href}>
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
