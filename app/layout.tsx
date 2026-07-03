import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "SignalAtlas",
  description: "Ranked research signals from XR and marine robotics labs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-950">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <a href="/" className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
              SignalAtlas
            </a>

            <nav className="flex items-center gap-4 text-sm text-zinc-600">
              <a href="/" className="hover:text-zinc-950">
                Feed
              </a>
              <a href="/labs" className="hover:text-zinc-950">
                Labs
              </a>
            </nav>
            <ThemeToggle />
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
