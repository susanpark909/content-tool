import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Viral Heist",
  description: "Content research and script-writing tool",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,100..700,0..1,0&display=block"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col md:flex-row">
        <SiteNav />
        <main className="min-w-0 flex-1 max-md:overflow-x-hidden">{children}</main>
      </body>
    </html>
  );
}
