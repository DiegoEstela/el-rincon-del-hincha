import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Geist } from "next/font/google";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const bebas = Bebas_Neue({ variable: "--font-bebas", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Rincón del Hincha", template: "%s · Rincón del Hincha" },
  description:
    "La historia de tu club ya está escrita. La tuya se sigue jugando. Armá tu DNI futbolero y compará tu historia con la de tus amigos.",
};

export const viewport: Viewport = {
  themeColor: "#07140d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${geist.variable} ${bebas.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="bg-accent text-accent-contrast sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>
        <Header />
        <Sidebar />
        <main
          id="contenido"
          tabIndex={-1}
          className="w-full flex-1 px-4 pb-8 focus:outline-none lg:pt-10 lg:pr-10 lg:pl-72"
        >
          <div className="mx-auto max-w-3xl lg:max-w-6xl">{children}</div>
        </main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
