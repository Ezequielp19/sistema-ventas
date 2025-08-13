"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { useOptimizedPaginatedData } from "@/hooks/useOptimizedQueries"

interface OptimizedPaginationProps {
  path: string
  onDataChange: (data: any) => void
  pageSize?: number
  orderBy?: string
  className?: string
}

export default function OptimizedPagination({
  path,
  onDataChange,
  pageSize = 10,
  orderBy = "fecha",
  className = ""
}: OptimizedPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedPageSize, setSelectedPageSize] = useState(pageSize)

  // Usar paginación optimizada
  const { data, total, hasMore, loading } = useOptimizedPaginatedData(
    path,
    {
      page: currentPage,
      pageSize: selectedPageSize,
      orderBy
    }
  )

  // Notificar cambios en datos
  useEffect(() => {
    onDataChange(data)
  }, [data, onDataChange])

  // Resetear página cuando cambia el tamaño
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedPageSize])

  const totalPages = Math.ceil(total / selectedPageSize)

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const renderPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button
          key={i}
          variant={i === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => handlePageChange(i)}
          disabled={loading}
          className="w-8 h-8"
        >
          {i}
        </Button>
      )
    }

    return pages
  }

  if (totalPages <= 1) {
    return null
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Información de página */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Página {currentPage} de {totalPages}
        </span>
        <span>•</span>
        <span>
          {total} elementos total
        </span>
        {loading && (
          <>
            <span>•</span>
            <span className="text-blue-600">Cargando...</span>
          </>
        )}
      </div>

      {/* Controles de paginación */}
      <div className="flex items-center gap-2">
        {/* Tamaño de página */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Mostrar:</span>
          <Select value={selectedPageSize.toString()} onValueChange={(value) => setSelectedPageSize(Number(value))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Botones de navegación */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || loading}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Números de página */}
          <div className="flex items-center gap-1">
            {renderPageNumbers()}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages || loading}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
} 