import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Geist } from "next/font/google";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const bebas = Bebas_Neue({ variable: "--font-bebas", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Rincón del Hincha", template: "%s · Rincón del Hincha" },
  description:
    "La historia de tu club ya está escrita. La tuya se sigue jugando. Armá tu DNI futbolero y compará tu historia con la de tus amigos.",
};

export const viewport: Viewport = {
  themeColor: "#060d1f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${geist.variable} ${bebas.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header />
        <main id="contenido" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-8">
          {children}
        </main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
