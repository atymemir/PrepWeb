import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "PrepWeb",
  description: "Focused SAT practice",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <div className="sticky top-0 z-50 border-b bg-white">
          <div className="mx-auto max-w-3xl px-6 py-3 flex items-center justify-between">
            <Link href="/today" className="font-semibold">PrepWeb</Link>
            <nav className="flex gap-4 text-sm">
              <Link className="hover:underline" href="/today">Today</Link>
              <Link className="hover:underline" href="/practice?subject=Reading">Practice</Link>
              <Link className="hover:underline" href="/skills">Skills</Link>
              <Link className="hover:underline" href="/leagues">Leagues</Link>
              <Link className="hover:underline" href="/profile">Profile</Link>
            </nav>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-6 py-6">
          {children}
        </div>
      </body>
    </html>
  );
}
