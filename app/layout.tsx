import "./globals.css";
import { Montserrat } from "next/font/google";
import Header from "./components/Header";
import AppFrame from "./components/AppFrame";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${montserrat.className} text-black antialiased`}>
        <Header />
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
