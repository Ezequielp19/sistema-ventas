# 🛍️ Mi Tienda - Sistema de Ventas Firebase

## 📋 Descripción

La nueva sección **"Mi Tienda"** te permite crear y gestionar tu catálogo de productos digital para compartir con clientes a través de WhatsApp. Es perfecta para emprendedores, comercios pequeños y vendedores que quieren mostrar sus productos de forma profesional.

## ✨ Características Principales

### 🎯 Gestión de Productos
- **Subir productos con imágenes**: Carga fotos de alta calidad de tus productos
- **Información completa**: Nombre, descripción, precio, stock, categoría
- **Productos destacados**: Marca tus mejores productos para que resalten
- **Control de stock**: Gestiona la disponibilidad de cada producto
- **Estados activo/inactivo**: Controla qué productos se muestran

### 📱 Integración con WhatsApp
- **Botón "Comprar por WhatsApp"**: En cada producto para que los clientes contacten directamente
- **Compartir productos**: Envía información detallada de productos por WhatsApp
- **Mensajes personalizados**: Se generan automáticamente con toda la información del producto
- **Enlaces directos**: Comparte enlaces únicos de cada producto

### ⚙️ Configuración de Tienda
- **Información de contacto**: WhatsApp, teléfono, email
- **Datos de la empresa**: Nombre, descripción, dirección, horarios
- **Redes sociales**: Facebook, Instagram, Twitter
- **Personalización completa**: Adapta la información a tu negocio

## 🚀 Cómo Usar

### 1. Configurar tu Tienda
1. Ve a la pestaña **"Mi Tienda"** en el dashboard
2. Haz clic en **"Configuración"**
3. Completa la información de tu tienda:
   - **Nombre de la tienda** (obligatorio)
   - **WhatsApp** (obligatorio para los botones de compra)
   - **Descripción** de tu negocio
   - **Dirección** y horarios
   - **Redes sociales**

### 2. Agregar Productos
1. En la pestaña **"Mis Productos"**
2. Haz clic en **"Agregar Producto"**
3. Completa la información:
   - **Nombre del producto**
   - **Precio** (solo precio de venta)
   - **Stock** disponible
   - **Categoría** (opcional)
   - **Descripción** detallada
   - **Imagen** del producto
   - **Marcar como destacado** (opcional)
   - **Activar/desactivar** producto

### 3. Compartir Productos
1. En la lista de productos, haz clic en **"Compartir"**
2. Elige cómo compartir:
   - **WhatsApp**: Envía mensaje directo con información del producto
   - **Enlace directo**: Copia el enlace único del producto

### 4. Botón "Comprar por WhatsApp"
- Aparece automáticamente en productos activos con stock
- Los clientes pueden hacer clic y contactarte directamente
- Se genera un mensaje automático con los detalles del producto

## 📊 Estadísticas de la Tienda

La sección muestra estadísticas en tiempo real:
- **Total de productos** en tu catálogo
- **Productos activos** disponibles
- **Productos destacados** 
- **Productos sin stock**

## 🔧 Configuración Técnica

### Estructura de Datos
Los productos se guardan en Firebase con la siguiente estructura:
```json
{
  "tiendas": {
    "userId": {
      "config": {
        "nombre": "Mi Tienda",
        "whatsapp": "5491112345678",
        "descripcion": "...",
        "direccion": "...",
        "horarios": "..."
      },
      "productos": {
        "productoId": {
          "nombre": "Producto",
          "precio": 1000,
          "stock": 10,
          "categoria": "Electrónicos",
          "descripcion": "...",
          "imagen": "url",
          "destacado": true,
          "activo": true,
          "fechaCreacion": "2024-01-01T00:00:00.000Z"
        }
      }
    }
  }
}
```

### Almacenamiento de Imágenes
- Las imágenes se suben a **Firebase Storage**
- Se organizan por usuario: `tienda/{userId}/{timestamp}_{filename}`
- Se optimizan automáticamente para web

## 📱 Funcionalidades de WhatsApp

### Mensaje de Compartir Producto
```
¡Hola! Te comparto este producto de mi tienda:

*Nombre del Producto*
Descripción del producto

💰 Precio: $1000
📦 Stock disponible: 10 unidades

¿Te interesa? ¡Contáctame para más información!
```

### Mensaje de Compra
```
¡Hola! Quiero comprar:

*Nombre del Producto*
💰 Precio: $1000

¿Tienes stock disponible?
```

## 🎨 Personalización

### Colores y Estilos
- **Botones de WhatsApp**: Verde (#16a34a)
- **Productos destacados**: Badge amarillo
- **Productos inactivos**: Badge rojo
- **Diseño responsive**: Se adapta a móviles y desktop

### Iconos Utilizados
- 🛍️ Store: Para la tienda
- 📱 Share2: Para compartir
- 🛒 ShoppingCart: Para comprar
- ⭐ Badge: Para destacados
- ❌ X: Para inactivos

## 🔒 Seguridad

- **Autenticación**: Solo usuarios logueados pueden gestionar su tienda
- **Aislamiento**: Cada usuario solo ve y gestiona sus propios productos
- **Validación**: Campos obligatorios y formatos validados
- **Backup**: Datos respaldados en Firebase

## 📈 Próximas Mejoras

- [ ] **Tienda pública**: Página web pública para mostrar productos
- [ ] **Carrito de compras**: Sistema de carrito integrado
- [ ] **Pagos online**: Integración con pasarelas de pago
- [ ] **Códigos QR**: Generar QR para cada producto
- [ ] **Analytics**: Estadísticas de visitas y conversiones
- [ ] **Notificaciones**: Alertas de nuevas consultas
- [ ] **Catálogo PDF**: Exportar catálogo completo

## 🆘 Soporte

Si tienes problemas o preguntas:
1. Revisa que tu número de WhatsApp esté configurado correctamente
2. Asegúrate de que las imágenes no sean muy grandes
3. Verifica que los productos estén marcados como "activos"
4. Contacta al soporte técnico si persisten los problemas

---

**¡Tu tienda digital está lista para vender! 🚀** 