"use client"

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface FacturaPDFData {
  numero: string
  fecha: string
  cliente: {
    nombre: string
    email?: string
    telefono?: string
    direccion?: string
    ruc?: string
  }
  items: Array<{
    nombre: string
    cantidad: number
    precio: number
    subtotal: number
  }>
  subtotal: number
  impuesto: number
  total: number
  metodoPago: string
  empresa: {
    nombre: string
    ruc: string
    direccion: string
    telefono: string
    email: string
  }
  terminosCondiciones: string
  porcentajeImpuesto: number
}

export const generarFacturaPDF = (factura: FacturaPDFData) => {
  const doc = new jsPDF()
  
  // Configuración de página
  const pageWidth = doc.internal.pageSize.width
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  
  let yPosition = margin

  // Encabezado de la empresa
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(factura.empresa.nombre, margin, yPosition)
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`RUC: ${factura.empresa.ruc}`, margin, yPosition)
  yPosition += 5
  doc.text(factura.empresa.direccion, margin, yPosition)
  yPosition += 5
  doc.text(`Tel: ${factura.empresa.telefono}`, margin, yPosition)
  yPosition += 5
  doc.text(`Email: ${factura.empresa.email}`, margin, yPosition)
  yPosition += 15

  // Título de factura y número
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('FACTURA', pageWidth - margin - 30, yPosition)
  yPosition += 10

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Número: ${factura.numero}`, pageWidth - margin - 30, yPosition)
  yPosition += 5
  doc.text(`Fecha: ${new Date(factura.fecha).toLocaleDateString('es-ES')}`, pageWidth - margin - 30, yPosition)
  yPosition += 15

  // Información del cliente
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Cliente:', margin, yPosition)
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nombre: ${factura.cliente.nombre}`, margin, yPosition)
  yPosition += 5
  
  if (factura.cliente.ruc) {
    doc.text(`RUC: ${factura.cliente.ruc}`, margin, yPosition)
    yPosition += 5
  }
  
  if (factura.cliente.direccion) {
    doc.text(`Dirección: ${factura.cliente.direccion}`, margin, yPosition)
    yPosition += 5
  }
  
  if (factura.cliente.telefono) {
    doc.text(`Teléfono: ${factura.cliente.telefono}`, margin, yPosition)
    yPosition += 5
  }
  
  if (factura.cliente.email) {
    doc.text(`Email: ${factura.cliente.email}`, margin, yPosition)
    yPosition += 5
  }

  yPosition += 10

  // Tabla de productos
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Productos:', margin, yPosition)
  yPosition += 8

  const tableData = factura.items.map(item => [
    item.nombre,
    item.cantidad.toString(),
    `$${item.precio.toFixed(2)}`,
    `$${item.subtotal.toFixed(2)}`
  ])

  autoTable(doc, {
    head: [['Producto', 'Cantidad', 'Precio', 'Subtotal']],
    body: tableData,
    startY: yPosition,
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  })

  // Obtener la posición Y después de la tabla
  const finalY = (doc as any).lastAutoTable.finalY + 10

  // Totales
  const totalX = pageWidth - margin - 80
  let totalY = finalY

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal:', totalX, totalY)
  doc.text(`$${factura.subtotal.toFixed(2)}`, pageWidth - margin, totalY)
  totalY += 5

  if (factura.impuesto > 0) {
    doc.text(`Impuesto (${factura.porcentajeImpuesto}%):`, totalX, totalY)
    doc.text(`$${factura.impuesto.toFixed(2)}`, pageWidth - margin, totalY)
    totalY += 5
  }

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Total:', totalX, totalY)
  doc.text(`$${factura.total.toFixed(2)}`, pageWidth - margin, totalY)
  totalY += 10

  // Método de pago
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Método de Pago: ${factura.metodoPago}`, margin, totalY)
  totalY += 15

  // Términos y condiciones
  if (factura.terminosCondiciones) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Términos y Condiciones:', margin, totalY)
    totalY += 5

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    
    // Dividir el texto en líneas que quepan en el ancho de la página
    const maxWidth = pageWidth - (margin * 2)
    const lines = doc.splitTextToSize(factura.terminosCondiciones, maxWidth)
    
    lines.forEach((line: string) => {
      doc.text(line, margin, totalY)
      totalY += 4
    })
  }

  // Pie de página
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text('Documento generado automáticamente', margin, pageHeight - 10)
  doc.text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}`, pageWidth - margin - 60, pageHeight - 10)

  // Guardar PDF
  doc.save(`factura_${factura.numero}_${new Date().toISOString().split('T')[0]}.pdf`)
}

export const generarFacturaEmail = (factura: FacturaPDFData) => {
  const asunto = `Factura ${factura.numero} - ${factura.empresa.nombre}`
  
  const cuerpo = `
Estimado/a ${factura.cliente.nombre},

Adjunto encontrará la factura ${factura.numero} correspondiente a su compra.

Detalles de la factura:
- Número: ${factura.numero}
- Fecha: ${new Date(factura.fecha).toLocaleDateString('es-ES')}
- Total: $${factura.total.toFixed(2)}

Si tiene alguna pregunta, no dude en contactarnos.

Saludos cordiales,
${factura.empresa.nombre}
${factura.empresa.telefono}
${factura.empresa.email}
  `.trim()

  return {
    asunto,
    cuerpo,
    email: factura.cliente.email || ''
  }
} 