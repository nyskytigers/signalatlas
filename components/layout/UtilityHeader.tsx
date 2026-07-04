//components/layout/UtilityHeader.tsx
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function UtilityHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-title">
        SignalAtlas
      </Link>

      <nav className="site-nav" aria-label="Primary">
        <Link href="/">feed</Link>
        <Link href="/labs">labs</Link>
        <Link href="/trending">trending</Link>
        <Link href="/search">search</Link>
        <Link href="/admin">admin</Link>
      </nav>
     
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}