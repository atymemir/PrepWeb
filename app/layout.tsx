import "./globals.css";
import Header from "./components/Header";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-black antialiased">
        <Header />
        <main className="app-canvas mx-auto max-w-6xl px-4 pb-28 pt-5 md:pb-12 md:pt-7">
          {children}
        </main>
      </body>
    </html>
  );
}
