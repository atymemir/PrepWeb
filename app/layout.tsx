import "./globals.css";
import Header from "./components/Header";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-black antialiased">
        <Header />
        <main className="mx-auto max-w-6xl px-4 pt-6 pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
