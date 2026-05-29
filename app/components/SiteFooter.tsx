'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandWordmark from "@/app/components/BrandWordmark";

function isStudyPath(pathname: string): boolean {
  return (
    pathname.startsWith("/today") ||
    pathname.startsWith("/practice") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/skills") ||
    pathname.startsWith("/lessons") ||
    pathname.startsWith("/lesson") ||
    pathname.startsWith("/coach") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/leagues")
  );
}

const productLinks = [
  { href: "/", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Plans" },
  { href: "/login", label: "Sign in" },
];

export default function SiteFooter() {
  const pathname = usePathname() || "/";
  const study = isStudyPath(pathname);

  if (study) {
    return (
      <footer className="border-t border-white/60 bg-[linear-gradient(180deg,rgba(248,251,255,0.72),rgba(243,247,255,0.66))] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 text-xs text-[#5f6f8c]">
          <span className="accent-sheen inline-flex rounded-full px-2.5 py-1">
            <BrandWordmark compact className="display-font font-bold text-[#2f4467]" />
          </span>
          <span className="font-medium">Focused study mode</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-8 border-t border-white/60 bg-[linear-gradient(180deg,rgba(248,251,255,0.9),rgba(242,247,255,0.86))] backdrop-blur">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <BrandWordmark className="display-font text-lg font-bold text-[#0e1b34]" />
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[#556684]">
            Know exactly what to study next for SAT and AP. Practice builds signal,
            review clears debt, and daily actions stay specific.
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7f9f]">Product</div>
          <div className="mt-3 grid gap-2 text-sm">
            {productLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[#2f4467] hover:text-[#0e1b34]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7f9f]">Support</div>
          <div className="mt-3 grid gap-2 text-sm text-[#2f4467]">
            <span>support@algaprep.tech</span>
            <Link href="/privacy" className="hover:text-[#0e1b34]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#0e1b34]">
              Terms
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 text-xs text-[#6f80a0]">
          <span>© {new Date().getFullYear()} algₐ prep</span>
          <span>Serious prep system for focused students</span>
        </div>
      </div>
    </footer>
  );
}
