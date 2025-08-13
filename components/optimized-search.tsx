"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, X, Loader2 } from "lucide-react"
import { useOptimizedSearch } from "@/hooks/useOptimizedQueries"

interface OptimizedSearchProps {
  path: string
  searchFields: string[]
  onResultsChange: (results: any) => void
  placeholder?: string
  className?: string
  debounceMs?: number
}

export default function OptimizedSearch({
  path,
  searchFields,
  onResultsChange,
  placeholder = "Buscar...",
  className = "",
  debounceMs = 300
}: OptimizedSearchProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [localSearchTerm, setLocalSearchTerm] = useState("")

  // Usar búsqueda optimizada
  const { data: searchResults, loading } = useOptimizedSearch(
    path,
    localSearchTerm,
    searchFields
  )

  // Debounce local para mejor UX
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setLocalSearchTerm(searchTerm)
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, debounceMs])

  // Notificar cambios en resultados
  useEffect(() => {
    onResultsChange(searchResults)
  }, [searchResults, onResultsChange])

  const handleClear = () => {
    setSearchTerm("")
    setLocalSearchTerm("")
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {searchTerm && !loading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
} 