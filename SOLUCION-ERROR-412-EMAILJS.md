# 🔧 Solución al Error 412 de EmailJS

## 🚨 Error Común

El error **412 (Precondition Failed)** en EmailJS generalmente indica que hay un problema con la configuración del template o las variables.

## ✅ Soluciones Paso a Paso

### 1. Verificar el Template en EmailJS Dashboard

1. Ve a [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Navega a **Email Templates**
3. Busca el template con ID: `template_m8gla55`
4. Verifica que el template esté **activo** y **publicado**

### 2. Configurar el Campo "To Email" (IMPORTANTE)

El error 412 a menudo ocurre porque falta configurar el campo "To Email" en el template:

1. En el editor del template, busca la sección **"To Email"** o **"Recipient"**
2. Configura el campo para usar la variable: `{{to_email}}`
3. **Asegúrate de que este campo esté configurado**, de lo contrario EmailJS no sabrá a dónde enviar el email

### 3. Verificar las Variables del Template

Asegúrate de que todas estas variables estén en el template:

- `{{to_email}}` - **OBLIGATORIO** - Email del destinatario
- `{{to_name}}` - Nombre del usuario
- `{{user_email}}` - Email de acceso
- `{{user_password}}` - Contraseña
- `{{login_url}}` - URL del sistema
- `{{app_name}}` - Nombre de la aplicación

### 4. Verificar el Servicio de Email

1. Ve a **Email Services** en EmailJS
2. Verifica que el servicio `service_f0e608c` esté:
   - ✅ Activo
   - ✅ Configurado correctamente
   - ✅ Vinculado al template

### 5. Verificar la Configuración del Template

En el editor del template, asegúrate de:

1. **Asunto del Email:**
   ```
   Bienvenido a {{app_name}} - Tus credenciales de acceso
   ```

2. **Campo "To Email" (CRÍTICO):**
   ```
   {{to_email}}
   ```
   ⚠️ **Este campo es OBLIGATORIO y debe estar configurado**

3. **Contenido HTML:**
   - Usa el contenido del archivo `EMAILJS-TEMPLATE.html`
   - Asegúrate de que todas las variables estén escritas exactamente como se muestra

### 6. Verificar los IDs

Confirma que estos valores sean correctos:

- **Service ID**: `service_f0e608c`
- **Template ID**: `template_m8gla55`
- **Public Key**: `HV8KNcQorsxYP088j`

## 🔍 Debugging

### Verificar en la Consola del Navegador

Cuando intentes enviar un email, revisa la consola del navegador. Deberías ver:

```
Enviando email con parámetros: {
  serviceId: "service_f0e608c",
  templateId: "template_m8gla55",
  to: "usuario@ejemplo.com",
  ...
}
```

Si ves un error 412, revisa:

1. **¿El template existe?** - Verifica en EmailJS Dashboard
2. **¿El campo "To Email" está configurado?** - Este es el error más común
3. **¿Las variables coinciden?** - Compara las variables del template con las enviadas

### Probar con EmailJS Test

1. En EmailJS Dashboard, ve al template
2. Haz clic en **"Test"** o **"Send Test Email"**
3. Ingresa un email de prueba
4. Verifica que el template funcione correctamente

## 📋 Checklist de Verificación

Antes de intentar enviar un email, verifica:

- [ ] El template `template_m8gla55` existe en EmailJS
- [ ] El template está **activo** y **publicado**
- [ ] El campo **"To Email"** está configurado con `{{to_email}}`
- [ ] El servicio `service_f0e608c` está activo
- [ ] Todas las variables del template coinciden con las enviadas
- [ ] La Public Key es correcta: `HV8KNcQorsxYP088j`
- [ ] El plan de EmailJS tiene créditos disponibles

## 🎯 Solución Rápida

Si el error persiste, intenta:

1. **Recrear el template:**
   - Crea un nuevo template en EmailJS
   - Copia el contenido de `EMAILJS-TEMPLATE.html`
   - **Configura el campo "To Email" con `{{to_email}}`**
   - Actualiza el Template ID en el código si es necesario

2. **Verificar el formato de las variables:**
   - En EmailJS, las variables deben estar entre dobles llaves: `{{variable_name}}`
   - No debe haber espacios: `{{ variable_name }}` ❌ vs `{{variable_name}}` ✅

3. **Probar con un template simple primero:**
   - Crea un template de prueba con solo el campo "To Email"
   - Si funciona, agrega el contenido completo gradualmente

## 📞 Soporte Adicional

Si el problema persiste:

1. Revisa los [logs de EmailJS](https://dashboard.emailjs.com/admin/integration)
2. Consulta la [documentación oficial de EmailJS](https://www.emailjs.com/docs/)
3. Verifica los [límites de tu plan](https://www.emailjs.com/pricing/)

## ⚠️ Nota Importante

El error 412 **NO** interrumpe la creación del usuario. El usuario se crea correctamente en Firebase, pero el email no se envía. Esto es intencional para que el sistema siga funcionando incluso si hay problemas con el envío de emails.

