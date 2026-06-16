"use client"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { ExportDataType } from "@/types"

type ExportFormat = "pdf" | "excel" | "csv"
type ExportCellValue = string | number | boolean | null | undefined | Date | ExportCellValue[] | Record<string, unknown>
type ExportRow = Record<string, ExportCellValue>

type ExportConfig = {
  title: string
  columns: string[]
}

const getSafeFileName = (title: string, extension: string) => {
  const baseName = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]/g, "_")

  return `${baseName}_${new Date().toISOString().split("T")[0]}.${extension}`
}

const isDateValue = (value: unknown): value is Date => value instanceof Date

const formatDateValue = (value: unknown): string => {
  if (isDateValue(value)) {
    return value.toLocaleDateString("es-ES")
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("es-ES")
  }

  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString("es-ES")
  }

  return ""
}

const formatObjectValue = (value: Record<string, unknown>): string => {
  const preferredKeys = ["nombre", "name", "titulo", "title", "id"]
  for (const key of preferredKeys) {
    const currentValue = value[key]
    if (typeof currentValue === "string" && currentValue.trim()) {
      return currentValue
    }
    if (typeof currentValue === "number" && Number.isFinite(currentValue)) {
      return String(currentValue)
    }
  }

  return JSON.stringify(value)
}

const formatArrayValue = (value: ExportCellValue[]): string => {
  return value
    .map((item) => {
      if (item === null || item === undefined) {
        return ""
      }

      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        return String(item)
      }

      if (isDateValue(item)) {
        return item.toLocaleDateString("es-ES")
      }

      if (Array.isArray(item)) {
        return formatArrayValue(item)
      }

      return formatObjectValue(item)
    })
    .filter((item) => item.trim() !== "")
    .join(" | ")
}

const formatNumericValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value)
  }

  return ""
}

const formatCellValue = (column: string, value: ExportCellValue): string | number => {
  if (value === null || value === undefined) {
    return ""
  }

  if (column === "fecha") {
    return formatDateValue(value)
  }

  if (column === "precio" || column === "total" || column === "stock" || column === "cantidad" || column === "valor") {
    const numericValue = formatNumericValue(value)
    return typeof numericValue === "number" ? `$${numericValue.toFixed(2)}` : ""
  }

  if (typeof value === "number") {
    return value
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No"
  }

  if (typeof value === "string") {
    return value
  }

  if (isDateValue(value)) {
    return formatDateValue(value)
  }

  if (Array.isArray(value)) {
    return formatArrayValue(value)
  }

  if (typeof value === "object") {
    return formatObjectValue(value)
  }

  return String(value)
}

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

// Función para exportar a PDF
export const exportToPDF = (data: ExportRow[], title: string, columns: string[]) => {
  const doc = new jsPDF()

  // Título del documento
  doc.setFontSize(18)
  doc.text(title, 14, 22)

  // Fecha de exportación
  doc.setFontSize(10)
  doc.text(`Exportado el: ${new Date().toLocaleDateString("es-ES")}`, 14, 32)

  // Preparar datos para la tabla
  const tableData = data.map((item) => {
    return columns.map((column) => formatCellValue(column, item[column]))
  })

  // Generar tabla
  autoTable(doc, {
    head: [columns.map((column) => column.charAt(0).toUpperCase() + column.slice(1))],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  })

  // Guardar PDF
  doc.save(getSafeFileName(title, "pdf"))
}

// Función para exportar a Excel
export const exportToExcel = (data: ExportRow[], title: string, columns: string[]) => {
  // Preparar datos para Excel
  const excelData = data.map((item) => {
    const row: Record<string, string | number> = {}

    columns.forEach((column) => {
      const header = column.charAt(0).toUpperCase() + column.slice(1)
      const formattedValue = formatCellValue(column, item[column])
      row[header] = typeof formattedValue === "number" ? formattedValue : String(formattedValue)
    })

    return row
  })

  // Crear workbook y worksheet
  const ws = XLSX.utils.json_to_sheet(excelData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title)

  // Generar archivo Excel
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const dataBlob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

  // Descargar archivo
  downloadBlob(dataBlob, getSafeFileName(title, "xlsx"))
}

// Función para exportar a CSV
export const exportToCSV = (data: ExportRow[], title: string, columns: string[]) => {
  const headers = columns.map((column) => column.charAt(0).toUpperCase() + column.slice(1))

  const csvData = data.map((item) => {
    return columns.map((column) => {
      const formattedValue = formatCellValue(column, item[column])
      const stringValue = typeof formattedValue === "number" ? String(formattedValue) : formattedValue
      return `"${String(stringValue).replace(/"/g, '""')}"`
    })
  })

  const csvContent = [headers.map((header) => `"${header}"`).join(","), ...csvData.map((row) => row.join(","))].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  downloadBlob(blob, getSafeFileName(title, "csv"))
}

// Función principal de exportación
export const exportData = async (data: ExportRow[], type: ExportDataType, format: ExportFormat) => {
  const configs: Record<ExportDataType, ExportConfig> = {
    ventas: {
      title: "Reporte de Ventas",
      columns: ["fecha", "cliente", "items", "metodoPago", "total"],
    },
    productos: {
      title: "Catálogo de Productos",
      columns: ["nombre", "descripcion", "precio", "stock", "stockMinimo", "categoria"],
    },
    proveedores: {
      title: "Lista de Proveedores",
      columns: ["nombre", "email", "telefono", "direccion", "categoria"],
    },
    stock: {
      title: "Control de Stock",
      columns: ["nombre", "stock", "stockMinimo", "categoria", "proveedor"],
    },
    reportes: {
      title: "Reporte General",
      columns: ["fecha", "tipo", "descripcion", "valor"],
    },
  }

  const config = configs[type]
  if (!config) {
    throw new Error(`Tipo de exportación no válido: ${type}`)
  }

  switch (format) {
    case "pdf":
      exportToPDF(data, config.title, config.columns)
      break
    case "excel":
      exportToExcel(data, config.title, config.columns)
      break
    case "csv":
      exportToCSV(data, config.title, config.columns)
      break
    default:
      throw new Error(`Formato no válido: ${format}`)
  }
}
