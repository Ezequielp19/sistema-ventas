# ðŸ”§ SoluciÃ³n al Error 412 de EmailJS

## ðŸš¨ Error ComÃºn

El error **412 (Precondition Failed)** en EmailJS generalmente indica que hay un problema con la configuraciÃ³n del template o las variables.

## âœ… Soluciones Paso a Paso

### 1. Verificar el Template en EmailJS Dashboard

1. Ve a [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Navega a **Email Templates**
3. Busca el template con ID: `template_njhbffj`
4. Verifica que el template estÃ© **activo** y **publicado**

### 2. Configurar el Campo "To Email" (IMPORTANTE)

El error 412 a menudo ocurre porque falta configurar el campo "To Email" en el template:

1. En el editor del template, busca la secciÃ³n **"To Email"** o **"Recipient"**
2. Configura el campo para usar la variable: `{{to_email}}`
3. **AsegÃºrate de que este campo estÃ© configurado**, de lo contrario EmailJS no sabrÃ¡ a dÃ³nde enviar el email

### 3. Verificar las Variables del Template

AsegÃºrate de que todas estas variables estÃ©n en el template:

- `{{to_email}}` - **OBLIGATORIO** - Email del destinatario
- `{{to_name}}` - Nombre del usuario
- `{{user_email}}` - Email de acceso
- `{{user_password}}` - ContraseÃ±a
- `{{login_url}}` - URL del sistema
- `{{app_name}}` - Nombre de la aplicaciÃ³n

### 4. Verificar el Servicio de Email

1. Ve a **Email Services** en EmailJS
2. Verifica que el servicio `service_161dv6f` estÃ©:
   - âœ… Activo
   - âœ… Configurado correctamente
   - âœ… Vinculado al template

### 5. Verificar la ConfiguraciÃ³n del Template

En el editor del template, asegÃºrate de:

1. **Asunto del Email:**
   ```
   Bienvenido a {{app_name}} - Tus credenciales de acceso
   ```

2. **Campo "To Email" (CRÃTICO):**
   ```
   {{to_email}}
   ```
   âš ï¸ **Este campo es OBLIGATORIO y debe estar configurado**

3. **Contenido HTML:**
   - Usa el contenido del archivo `EMAILJS-TEMPLATE.html`
   - AsegÃºrate de que todas las variables estÃ©n escritas exactamente como se muestra

### 6. Verificar los IDs

Confirma que estos valores sean correctos:

- **Service ID**: `service_161dv6f`
- **Template ID**: `template_njhbffj`
- **Public Key**: `QLg98FNv2a5z4ZK77`

## ðŸ” Debugging

### Verificar en la Consola del Navegador

Cuando intentes enviar un email, revisa la consola del navegador. DeberÃ­as ver:

```
Enviando email con parÃ¡metros: {
  serviceId: "service_161dv6f",
  templateId: "template_njhbffj",
  to: "usuario@ejemplo.com",
  ...
}
```

Si ves un error 412, revisa:

1. **Â¿El template existe?** - Verifica en EmailJS Dashboard
2. **Â¿El campo "To Email" estÃ¡ configurado?** - Este es el error mÃ¡s comÃºn
3. **Â¿Las variables coinciden?** - Compara las variables del template con las enviadas

### Probar con EmailJS Test

1. En EmailJS Dashboard, ve al template
2. Haz clic en **"Test"** o **"Send Test Email"**
3. Ingresa un email de prueba
4. Verifica que el template funcione correctamente

## ðŸ“‹ Checklist de VerificaciÃ³n

Antes de intentar enviar un email, verifica:

- [ ] El template `template_njhbffj` existe en EmailJS
- [ ] El template estÃ¡ **activo** y **publicado**
- [ ] El campo **"To Email"** estÃ¡ configurado con `{{to_email}}`
- [ ] El servicio `service_161dv6f` estÃ¡ activo
- [ ] Todas las variables del template coinciden con las enviadas
- [ ] La Public Key es correcta: `QLg98FNv2a5z4ZK77`
- [ ] El plan de EmailJS tiene crÃ©ditos disponibles

## ðŸŽ¯ SoluciÃ³n RÃ¡pida

Si el error persiste, intenta:

1. **Recrear el template:**
   - Crea un nuevo template en EmailJS
   - Copia el contenido de `EMAILJS-TEMPLATE.html`
   - **Configura el campo "To Email" con `{{to_email}}`**
   - Actualiza el Template ID en el cÃ³digo si es necesario

2. **Verificar el formato de las variables:**
   - En EmailJS, las variables deben estar entre dobles llaves: `{{variable_name}}`
   - No debe haber espacios: `{{ variable_name }}` âŒ vs `{{variable_name}}` âœ…

3. **Probar con un template simple primero:**
   - Crea un template de prueba con solo el campo "To Email"
   - Si funciona, agrega el contenido completo gradualmente

## ðŸ“ž Soporte Adicional

Si el problema persiste:

1. Revisa los [logs de EmailJS](https://dashboard.emailjs.com/admin/integration)
2. Consulta la [documentaciÃ³n oficial de EmailJS](https://www.emailjs.com/docs/)
3. Verifica los [lÃ­mites de tu plan](https://www.emailjs.com/pricing/)

## âš ï¸ Nota Importante

El error 412 **NO** interrumpe la creaciÃ³n del usuario. El usuario se crea correctamente en Firebase, pero el email no se envÃ­a. Esto es intencional para que el sistema siga funcionando incluso si hay problemas con el envÃ­o de emails.


