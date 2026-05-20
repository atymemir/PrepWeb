import "./globals.css";
import Link from "next/link";
import BottomNav from "./components/BottomNav";

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
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
          {children}
        </main>

        {/* Bottom tabs */}
        <BottomNav />
      </body>
    </html>
  );
}