import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/contexts/theme-context"
import { AuthProvider } from "@/contexts/auth-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL("https://app.gestionpro.pro"),
  title: {
    default: "GestiónPro | gestionpro.app",
    template: "%s | GestiónPro",
  },
  description: "Sistema profesional de gestión de inventarios y ventas",
  applicationName: "GestiónPro",
  icons: {
    icon: "/logonuevo.png",
    shortcut: "/logonuevo.png",
    apple: "/logonuevo.png",
  },
  openGraph: {
    title: "GestiónPro | gestionpro.app",
    description: "Sistema profesional de gestión de inventarios y ventas",
    url: "https://app.gestionpro.pro",
    siteName: "GestiónPro",
    images: [
      {
        url: "/logonuevo.png",
        width: 512,
        height: 512,
        alt: "GestiónPro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GestiónPro | gestionpro.app",
    description: "Sistema profesional de gestión de inventarios y ventas",
    images: ["/logonuevo.png"],
  },
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} overflow-x-hidden`}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
