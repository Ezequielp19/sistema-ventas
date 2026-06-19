"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform?: string
  }>
}

const isStandaloneMode = () => {
  if (typeof window === "undefined") {
    return false
  }

  const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches
  const appleStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  return standaloneMedia || appleStandalone
}

const isIOSDevice = () => {
  if (typeof navigator === "undefined") {
    return false
  }

  const userAgent = navigator.userAgent.toLowerCase()
  const isAppleTouchDevice = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1

  return /iphone|ipad|ipod/.test(userAgent) || isAppleTouchDevice
}

export function InstallAppButton() {
  const pathname = usePathname()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const isPublicStoreRoute = pathname?.startsWith("/tienda/")

  useEffect(() => {
    setIsIOS(isIOSDevice())
    setIsInstalled(isStandaloneMode())

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      deferredPromptRef.current = promptEvent
      setDeferredPrompt(promptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      deferredPromptRef.current = null
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("No se pudo registrar el Service Worker:", error)
      })
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  if (isInstalled) {
    return null
  }

  if (isPublicStoreRoute) {
    return null
  }

  const handleInstall = async () => {
    const promptEvent = deferredPromptRef.current

    if (promptEvent) {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === "accepted") {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
      deferredPromptRef.current = null
      return
    }

    if (isIOS) {
      window.alert("En iPhone o iPad: tocá Compartir y luego 'Agregar a pantalla de inicio'.")
      return
    }

    window.alert("Tu navegador todavía no habilitó la instalación. Probá recargar la página o abrí el menú del navegador y elegí 'Instalar app'.")
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)]">
      <Button
        type="button"
        onClick={handleInstall}
        className="gap-2 rounded-full shadow-lg"
        size="sm"
        title={isIOS ? "En iPhone o iPad: Compartir > Agregar a pantalla de inicio" : "Instalar aplicación"}
      >
        <Download className="h-4 w-4" />
        <span>Instalar</span>
      </Button>
      <div className="mt-2 rounded-full border bg-background/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
        Acceso directo en celular o PC
      </div>
    </div>
  )
}
