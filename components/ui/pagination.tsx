"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  // Mostrar solo un rango de páginas si hay muchas
  const getVisiblePages = () => {
    if (totalPages <= 7) return pages

    if (currentPage <= 4) {
      return [...pages.slice(0, 5), "...", totalPages]
    } else if (currentPage >= totalPages - 3) {
      return [1, "...", ...pages.slice(totalPages - 5)]
    } else {
      return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages]
    }
  }

  const visiblePages = getVisiblePages()

  return (
    <div className="flex items-center justify-center space-x-1 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Página anterior</span>
      </Button>

      {visiblePages.map((page, i) =>
        page === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2">
            ...
          </span>
        ) : (
          <Button
            key={`page-${page}`}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(page as number)}
            className="h-8 w-8 p-0"
          >
            {page}
          </Button>
        ),
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Página siguiente</span>
      </Button>
    </div>
  )
}

export const PaginationContent = ({ children }) => <div className="join">{children}</div>
export const PaginationItem = ({ children }) => <>{children}</>
export const PaginationLink = ({ children }) => <Button className="join-item">{children}</Button>
export const PaginationEllipsis = () => <span>...</span>
export const PaginationPrevious = ({ onClick, disabled }) => (
  <Button onClick={onClick} disabled={disabled}>
    Previous
  </Button>
)
export const PaginationNext = ({ onClick, disabled }) => (
  <Button onClick={onClick} disabled={disabled}>
    Next
  </Button>
)
