# 🧾 Guía Práctica - Sistema de Facturación

## 🚀 Cómo Usar el Sistema de Facturación

### 📋 **Paso 1: Configuración Inicial**

1. **Acceder al sistema**
   - Inicia sesión en el sistema
   - Presiona **F8** o haz clic en la pestaña **"Facturación"**

2. **Configurar datos de empresa**
   - Ve a la pestaña **"Configuración"**
   - Completa los datos de tu empresa:
     - **Nombre de la empresa**
     - **RUC** (número de identificación fiscal)
     - **Dirección** completa
     - **Teléfono** de contacto
     - **Email** corporativo

3. **Configurar facturación**
   - **Prefijo de factura**: Ej: "FAC" (aparecerá como FAC-2024-0001)
   - **Porcentaje de impuesto**: Ej: 10% para IVA
   - **Términos y condiciones**: Texto que aparecerá en todas las facturas

4. **Guardar configuración**
   - Haz clic en **"Guardar Configuración"**

### 🧾 **Paso 2: Generar Factura**

1. **Seleccionar venta**
   - Ve a la pestaña **"Generar Factura"**
   - En el dropdown verás todas las ventas que aún no tienen factura
   - Selecciona la venta que quieres facturar

2. **Revisar detalles**
   - El sistema mostrará automáticamente:
     - **Cliente** de la venta
     - **Fecha** de la venta
     - **Total** de la venta
     - **Método de pago** utilizado
     - **Lista de productos** con cantidades y precios

3. **Generar factura**
   - Haz clic en **"Generar Factura"**
   - El sistema creará automáticamente:
     - Número de factura secuencial (ej: FAC-2024-0001)
     - Cálculo de impuestos
     - Guardado en la base de datos

### 📄 **Paso 3: Descargar e Imprimir**

#### **Opción A: Descargar PDF**
1. Ve a la pestaña **"Facturas"**
2. Busca la factura que quieres descargar
3. Haz clic en el ícono **📥 (Descargar)**
4. El PDF se descargará automáticamente

#### **Opción B: Ver y Descargar desde Modal**
1. En la lista de facturas, haz clic en el ícono **👁️ (Ver)**
2. Se abrirá una ventana con la vista previa completa
3. Haz clic en **"Descargar PDF"** para guardar el archivo
4. Haz clic en **"Imprimir"** para abrir el PDF en una nueva ventana e imprimir
5. Haz clic en **"Enviar por WhatsApp"** para enviar la factura al cliente

#### **Opción C: Enviar por WhatsApp**
1. **Si el cliente tiene teléfono configurado**:
   - Haz clic en **"Enviar por WhatsApp"** en el modal de vista previa
   - Se abrirá WhatsApp Web o la app con:
     - Destinatario: Número del cliente
     - Mensaje: Factura completa con formato profesional
     - Emojis y formato para mejor presentación

2. **Si el cliente no tiene teléfono configurado**:
   - Haz clic en **"Enviar por WhatsApp"**
   - Se abrirá un modal para ingresar el número del cliente
   - Ingresa el número y haz clic en **"Enviar WhatsApp"**
   - Se abrirá WhatsApp con el mensaje prellenado

### 🔍 **Paso 4: Gestionar Facturas**

#### **Buscar Facturas**
- **Búsqueda por número**: Escribe el número de factura
- **Búsqueda por cliente**: Escribe el nombre del cliente
- **Filtro por estado**: Selecciona "Pagada", "Pendiente" o "Anulada"

#### **Ver Historial**
- Todas las facturas aparecen en la tabla principal
- Usa la paginación para navegar entre páginas
- Exporta el historial completo en PDF, Excel o CSV

## 🎯 **Características del PDF Generado**

### 📋 **Contenido del PDF**
- **Encabezado**: Datos de la empresa (nombre, RUC, dirección, contacto)
- **Número de factura**: Secuencial automático (ej: FAC-2024-0001)
- **Fecha**: Fecha de generación de la factura
- **Cliente**: Nombre y datos del cliente
- **Productos**: Tabla con nombre, cantidad, precio y subtotal
- **Totales**: Subtotal, impuestos y total final
- **Método de pago**: Forma de pago utilizada
- **Términos y condiciones**: Texto configurado
- **Pie de página**: Información de generación

### 🎨 **Diseño del PDF**
- **Formato profesional** listo para impresión
- **Tablas automáticas** con productos
- **Cálculos precisos** de impuestos y totales
- **Datos de empresa** personalizables
- **Numeración fiscal** cumpliendo requisitos legales

#### **Envío por WhatsApp**
- **Plantilla de mensaje** - Formato profesional con emojis
- **Enlace directo** - Se abre WhatsApp Web o app
- **Datos automáticos** - Cliente y factura
- **Configuración flexible** - Teléfono del cliente opcional
- **WhatsApp Web/App** - Se abre automáticamente

## ⚡ **Atajos de Teclado**

- **F8**: Acceso directo a la pestaña de Facturación
- **F1**: Nueva venta (para luego facturar)
- **F2**: Proveedores
- **F3**: Productos
- **F7**: Reportes

## 🔧 **Solución de Problemas**

### ❌ **La factura no se descarga**
- **Verificar**: Que el navegador permita descargas
- **Solución**: Hacer clic en "Permitir descargas" si aparece el mensaje
- **Alternativa**: Usar el botón "Imprimir" que abre el PDF en nueva ventana

### ❌ **No aparecen ventas para facturar**
- **Verificar**: Que existan ventas en el sistema
- **Verificar**: Que las ventas no tengan factura previa
- **Solución**: Crear una nueva venta primero (F1)

### ❌ **Los datos de empresa no aparecen**
- **Verificar**: Que se haya guardado la configuración
- **Solución**: Ir a "Configuración" y guardar nuevamente

### ❌ **Error en cálculos de impuestos**
- **Verificar**: El porcentaje de impuesto configurado
- **Solución**: Ajustar en la configuración y guardar

### ❌ **No se puede enviar por WhatsApp**
- **Verificar**: Que el cliente tenga teléfono configurado
- **Solución**: Ingresar el número del cliente en el modal que aparece
- **Alternativa**: Usar el botón "Descargar PDF" y enviar manualmente
- **Formato**: El número debe incluir código de país (ej: +595 99 123 456)

## 📊 **Estados de Factura**

- **🟢 Pagada**: Factura completamente pagada
- **🟡 Pendiente**: Factura con pago pendiente
- **🔴 Anulada**: Factura cancelada

## 🎯 **Mejores Prácticas**

### ✅ **Recomendaciones**
1. **Configurar datos de empresa** antes de generar la primera factura
2. **Revisar detalles** antes de generar la factura
3. **Guardar PDFs** en una carpeta organizada
4. **Verificar cálculos** antes de enviar al cliente
5. **Usar numeración secuencial** para cumplimiento fiscal

### ❌ **Evitar**
1. Generar facturas sin configurar datos de empresa
2. Modificar facturas ya generadas
3. Usar números de factura duplicados
4. Enviar facturas sin revisar cálculos

## 🚀 **Próximas Funcionalidades**

### 🔮 **En Desarrollo**
- **Envío automático por WhatsApp** al cliente
- **Plantillas múltiples** de factura
- **Firmas digitales** en PDF
- **QR codes** para verificación
- **Integración contable** con sistemas externos

### 📈 **Métricas del Sistema**
- **Tiempo de generación**: < 5 segundos
- **Formato**: PDF profesional A4
- **Compatibilidad**: Todos los navegadores modernos
- **Cumplimiento**: Requisitos fiscales locales

---

## 🆘 **Soporte Técnico**

Si tienes problemas con el sistema de facturación:

1. **Verificar configuración** de datos de empresa
2. **Revisar navegador** y permisos de descarga
3. **Contactar soporte** con detalles del problema
4. **Incluir capturas de pantalla** si es necesario

---

**¡El sistema de facturación está listo para usar! 🎉** 