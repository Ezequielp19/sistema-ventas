"use client"

import { useClient } from "@/hooks/use-client"
import { ReactNode } from "react"

interface ClientOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const isClient = useClient()

  if (!isClient) {
    return <>{fallback}</>
  }

  return <>{children}</>
} 