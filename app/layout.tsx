import "./globals.css";
import Header from "./components/Header";
import AppFrame from "./components/AppFrame";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-black antialiased">
        <Header />
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
