import "./globals.css";
import Link from "next/link";

function BottomTabs() {
  const tabs = [
    { href: "/today", label: "Today" },
    { href: "/practice?subject=Reading", label: "Practice" },
    { href: "/review", label: "Review" },
    { href: "/skills", label: "Skills" },
    { href: "/leagues", label: "Leagues" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-2">
        <div className="grid grid-cols-5 gap-2">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-xl px-2 py-2 text-center text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-black"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-black">
        {/* Top bar */}
        <div className="sticky top-0 z-40 border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/today" className="text-sm font-extrabold tracking-[0.18em]">
              ALGA
            </Link>
            <Link href="/profile" className="text-sm font-semibold text-gray-600 hover:text-black">
              Profile
            </Link>
          </div>
        </div>

        {/* Content */}
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">{children}</main>

        {/* Tabs */}
        <BottomTabs />
      </body>
    </html>
  );
}