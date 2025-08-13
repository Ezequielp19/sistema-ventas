"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, FileText, FileSpreadsheet, File, AlertCircle, CheckCircle } from "lucide-react"
import { exportData } from "./export-utils"
import { ExportDataType } from "@/types"

interface ExportButtonsProps {
  data: any[]
  type: ExportDataType
  title?: string
  className?: string
}

export default function ExportButtons({ data, type, title, className }: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    if (data.length === 0) {
      setError("No hay datos para exportar")
      return
    }

    setIsExporting(true)
    setError("")
    setSuccess("")

    try {
      await exportData(data, type, format)
      setSuccess(`Datos exportados exitosamente en formato ${format.toUpperCase()}`)
      
      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      console.error("Error al exportar:", err)
      setError(`Error al exportar datos: ${err instanceof Error ? err.message : 'Error desconocido'}`)
      
      // Limpiar mensaje de error después de 5 segundos
      setTimeout(() => setError(""), 5000)
    } finally {
      setIsExporting(false)
    }
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <FileText className="h-4 w-4" />
      case 'excel':
        return <FileSpreadsheet className="h-4 w-4" />
      case 'csv':
        return <File className="h-4 w-4" />
      default:
        return <Download className="h-4 w-4" />
    }
  }

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'pdf':
        return 'PDF'
      case 'excel':
        return 'Excel'
      case 'csv':
        return 'CSV'
      default:
        return format.toUpperCase()
    }
  }

  return (
    <div className={className}>
      {/* Mensajes de estado */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="mb-4">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Botones de exportación */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            disabled={isExporting || data.length === 0}
            className="min-w-[140px]"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exportando..." : "Exportar"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            className="cursor-pointer"
          >
            {getFormatIcon('pdf')}
            <span className="ml-2">{getFormatLabel('pdf')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleExport('excel')}
            disabled={isExporting}
            className="cursor-pointer"
          >
            {getFormatIcon('excel')}
            <span className="ml-2">{getFormatLabel('excel')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="cursor-pointer"
          >
            {getFormatIcon('csv')}
            <span className="ml-2">{getFormatLabel('csv')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
} 