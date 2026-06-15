# 📧 Configuración de EmailJS para Envío de Credenciales

## 📋 Información de Configuración

- **Service ID**: `service_f0e608c`
- **Template ID**: `template_m8gla55`
- **Public Key**: `HV8KNcQorsxYP088j`
- **URL de la aplicación**: `https://sistema-ventas-lilac.vercel.app/`

## 🚀 Pasos para Configurar el Template en EmailJS

### 1. Acceder a EmailJS Dashboard

1. Ve a [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Inicia sesión con tu cuenta

### 2. Crear/Editar el Template

1. En el menú lateral, haz clic en **Email Templates**
2. Busca el template con ID `template_m8gla55` o crea uno nuevo
3. Si es nuevo, asigna el ID: `template_m8gla55`

### 3. Configurar el Template

#### **Asunto del Email:**
```
Bienvenido a {{app_name}} - Tus credenciales de acceso
```

#### **Contenido del Email:**

Copia y pega el contenido del archivo `EMAILJS-TEMPLATE.html` en el editor de EmailJS.

**Variables disponibles en el template:**
- `{{to_name}}` - Nombre del usuario
- `{{to_email}}` - Email del destinatario
- `{{user_email}}` - Email de acceso del usuario
- `{{user_password}}` - Contraseña del usuario
- `{{login_url}}` - URL para acceder al sistema
- `{{app_name}}` - Nombre de la aplicación ("Sistema de Ventas")

### 4. Configurar el Servicio de Email

1. Ve a **Email Services** en el menú lateral
2. Verifica que el servicio `service_f0e608c` esté configurado correctamente
3. Si no existe, crea un nuevo servicio y asigna el ID: `service_f0e608c`

### 5. Verificar la Configuración

Asegúrate de que:
- ✅ El template tiene el ID correcto: `template_m8gla55`
- ✅ El servicio tiene el ID correcto: `service_f0e608c`
- ✅ La Public Key está configurada: `HV8KNcQorsxYP088j`
- ✅ Todas las variables están correctamente escritas con dobles llaves: `{{variable_name}}`

## 📝 Estructura del Email

El email incluye:

1. **Header con gradiente** - Título de bienvenida
2. **Saludo personalizado** - Con el nombre del usuario
3. **Caja de credenciales** - Email y contraseña destacados
4. **Botón CTA** - Botón para acceder al sistema
5. **Enlace alternativo** - URL completa como texto
6. **Aviso de seguridad** - Recomendación de cambiar la contraseña
7. **Footer** - Información legal y de contacto

## 🎨 Personalización del Template

Puedes personalizar el template editando:
- **Colores**: Cambia los gradientes y colores en el HTML
- **Texto**: Modifica los mensajes según tus necesidades
- **Logo**: Agrega un logo en el header si lo deseas
- **Estilo**: Ajusta el diseño para que coincida con tu marca

## ✅ Prueba del Sistema

Para probar que todo funciona:

1. Crea un nuevo usuario desde el panel de super administrador
2. Verifica que recibas el email en la dirección especificada
3. Revisa que todas las variables se reemplacen correctamente
4. Prueba el enlace de acceso

## 🔧 Solución de Problemas

### El email no se envía

1. Verifica que las credenciales de EmailJS sean correctas
2. Revisa la consola del navegador para ver errores
3. Asegúrate de que el servicio de email esté activo en EmailJS
4. Verifica los límites de tu plan de EmailJS

### Las variables no se reemplazan

1. Asegúrate de que las variables estén escritas exactamente como: `{{variable_name}}`
2. Verifica que los nombres de las variables coincidan con los enviados desde el código
3. Revisa que no haya espacios adicionales en las variables

### El email llega pero el formato está roto

1. Verifica que el HTML esté bien formateado
2. Asegúrate de usar tablas para el layout (mejor compatibilidad con clientes de email)
3. Prueba en diferentes clientes de email (Gmail, Outlook, etc.)

## 📚 Recursos Adicionales

- [Documentación de EmailJS](https://www.emailjs.com/docs/)
- [Guía de Templates](https://www.emailjs.com/docs/examples/reactjs/)
- [Variables en Templates](https://www.emailjs.com/docs/user-guide/template-variables/)

