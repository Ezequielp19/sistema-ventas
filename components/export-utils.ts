"use client"

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { ExportDataType, Venta, Producto, Proveedor } from '@/types'

// Función para exportar a PDF
export const exportToPDF = (data: any[], title: string, columns: string[]) => {
  const doc = new jsPDF()
  
  // Título del documento
  doc.setFontSize(18)
  doc.text(title, 14, 22)
  
  // Fecha de exportación
  doc.setFontSize(10)
  doc.text(`Exportado el: ${new Date().toLocaleDateString('es-ES')}`, 14, 32)
  
  // Preparar datos para la tabla
  const tableData = data.map(item => {
    return columns.map(col => {
      if (col === 'fecha' && item[col]) {
        return new Date(item[col]).toLocaleDateString('es-ES')
      }
      if (col === 'precio' || col === 'total' || col === 'stock' || col === 'cantidad') {
        return typeof item[col] === 'number' ? `$${item[col].toFixed(2)}` : item[col]
      }
      return item[col] || ''
    })
  })
  
  // Generar tabla
  autoTable(doc, {
    head: [columns.map(col => col.charAt(0).toUpperCase() + col.slice(1))],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  })
  
  // Guardar PDF
  doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
}

// Función para exportar a Excel
export const exportToExcel = (data: any[], title: string, columns: string[]) => {
  // Preparar datos para Excel
  const excelData = data.map(item => {
    const row: any = {}
    columns.forEach(col => {
      if (col === 'fecha' && item[col]) {
        row[col.charAt(0).toUpperCase() + col.slice(1)] = new Date(item[col]).toLocaleDateString('es-ES')
      } else if (col === 'precio' || col === 'total' || col === 'stock' || col === 'cantidad') {
        row[col.charAt(0).toUpperCase() + col.slice(1)] = typeof item[col] === 'number' ? item[col] : item[col] || ''
      } else {
        row[col.charAt(0).toUpperCase() + col.slice(1)] = item[col] || ''
      }
    })
    return row
  })
  
  // Crear workbook y worksheet
  const ws = XLSX.utils.json_to_sheet(excelData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title)
  
  // Generar archivo Excel
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  // Descargar archivo
  saveAs(dataBlob, `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// Función para exportar a CSV
export const exportToCSV = (data: any[], title: string, columns: string[]) => {
  // Preparar headers
  const headers = columns.map(col => col.charAt(0).toUpperCase() + col.slice(1))
  
  // Preparar datos
  const csvData = data.map(item => {
    return columns.map(col => {
      if (col === 'fecha' && item[col]) {
        return new Date(item[col]).toLocaleDateString('es-ES')
      }
      if (col === 'precio' || col === 'total' || col === 'stock' || col === 'cantidad') {
        return typeof item[col] === 'number' ? item[col].toFixed(2) : item[col] || ''
      }
      return item[col] || ''
    })
  })
  
  // Crear contenido CSV
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => row.join(','))
  ].join('\n')
  
  // Crear blob y descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
}

// Función principal de exportación
export const exportData = async (data: any[], type: ExportDataType, format: 'pdf' | 'excel' | 'csv') => {
  const configs = {
    ventas: {
      title: 'Reporte de Ventas',
      columns: ['fecha', 'cliente', 'items', 'metodoPago', 'total']
    },
    productos: {
      title: 'Catálogo de Productos',
      columns: ['nombre', 'descripcion', 'precio', 'stock', 'stockMinimo', 'categoria']
    },
    proveedores: {
      title: 'Lista de Proveedores',
      columns: ['nombre', 'email', 'telefono', 'direccion', 'categoria']
    },
    stock: {
      title: 'Control de Stock',
      columns: ['nombre', 'stock', 'stockMinimo', 'categoria', 'proveedor']
    },
    reportes: {
      title: 'Reporte General',
      columns: ['fecha', 'tipo', 'descripcion', 'valor']
    }
  }
  
  const config = configs[type]
  if (!config) {
    throw new Error(`Tipo de exportación no válido: ${type}`)
  }
  
  switch (format) {
    case 'pdf':
      exportToPDF(data, config.title, config.columns)
      break
    case 'excel':
      exportToExcel(data, config.title, config.columns)
      break
    case 'csv':
      exportToCSV(data, config.title, config.columns)
      break
    default:
      throw new Error(`Formato no válido: ${format}`)
  }
} 