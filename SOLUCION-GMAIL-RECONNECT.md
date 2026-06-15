# 🔧 Solución: Reconectar Gmail en EmailJS

## 🚨 Error Detectado

```
Gmail_API: Invalid grant. Please reconnect your Gmail account
```

Este error indica que la conexión de Gmail API en EmailJS ha expirado o necesita ser reconectada.

## ✅ Solución Paso a Paso

### 1. Acceder a EmailJS Dashboard

1. Ve a [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Inicia sesión con tu cuenta

### 2. Reconectar el Servicio de Gmail

1. En el menú lateral, haz clic en **Email Services** o **Integrations**
2. Busca el servicio con ID: `service_f0e608c`
3. Verás un botón que dice **"Reconnect"** o **"Reconectar"** (generalmente en rojo o con un ícono de advertencia)
4. Haz clic en **"Reconnect"**

### 3. Autorizar Gmail Nuevamente

1. Se abrirá una ventana de Google OAuth
2. Selecciona la cuenta de Gmail que quieres usar
3. Haz clic en **"Permitir"** o **"Allow"** para autorizar el acceso
4. Espera a que se complete la conexión

### 4. Verificar la Conexión

1. Después de reconectar, verifica que el estado del servicio muestre **"Connected"** o **"Conectado"**
2. Deberías ver un indicador verde o un checkmark
3. El servicio debería estar listo para enviar emails

## 🔄 Alternativa: Recrear el Servicio

Si la reconexión no funciona, puedes recrear el servicio:

### Opción 1: Usar el mismo ID

1. Elimina el servicio actual `service_f0e608c`
2. Crea un nuevo servicio de Gmail
3. Asigna el mismo ID: `service_f0e608c`
4. Conecta tu cuenta de Gmail
5. Vincula el servicio al template `template_m8gla55`

### Opción 2: Actualizar el ID en el código

1. Crea un nuevo servicio de Gmail en EmailJS
2. Anota el nuevo Service ID
3. Actualiza el código en `components/super-admin-panel.tsx`:

```typescript
const EMAILJS_CONFIG = {
  serviceId: "TU_NUEVO_SERVICE_ID", // Reemplaza con el nuevo ID
  templateId: "template_m8gla55",
  publicKey: "HV8KNcQorsxYP088j"
}
```

## 🔍 Verificar que Funciona

1. Intenta crear un nuevo usuario desde el panel de super administrador
2. Revisa la consola del navegador - no debería haber errores 412
3. Verifica que recibas el email en la dirección especificada

## ⚠️ Notas Importantes

### ¿Por qué expira la conexión?

- Las conexiones OAuth de Gmail pueden expirar por seguridad
- Si cambias la contraseña de Gmail, la conexión se invalida
- Google puede revocar permisos por inactividad
- Cambios en la configuración de seguridad de Google pueden invalidar la conexión

### Prevención

- Revisa periódicamente el estado de los servicios en EmailJS
- Configura alertas en EmailJS si están disponibles
- Mantén un registro de cuándo se reconectó el servicio

## 🆘 Si el Problema Persiste

### Verificar Permisos de Gmail

1. Ve a [Google Account Security](https://myaccount.google.com/security)
2. Revisa las **"Third-party apps with account access"**
3. Busca EmailJS en la lista
4. Si no aparece o está deshabilitado, reconéctalo desde EmailJS

### Verificar Límites de Gmail

1. Gmail tiene límites de envío diarios
2. Verifica que no hayas excedido el límite
3. Revisa en EmailJS Dashboard si hay mensajes sobre límites

### Contactar Soporte

Si nada funciona:

1. Contacta el soporte de EmailJS: [support@emailjs.com](mailto:support@emailjs.com)
2. Menciona el error: `Gmail_API: Invalid grant`
3. Proporciona el Service ID: `service_f0e608c`
4. Incluye capturas de pantalla del error

## 📋 Checklist de Verificación

Antes de intentar enviar emails nuevamente:

- [ ] El servicio `service_f0e608c` está conectado (estado verde)
- [ ] La cuenta de Gmail está autorizada
- [ ] El template `template_m8gla55` está vinculado al servicio
- [ ] No hay errores en el dashboard de EmailJS
- [ ] Los límites de Gmail no están excedidos

## 🎯 Solución Rápida

**Pasos rápidos para reconectar:**

1. [Dashboard EmailJS](https://dashboard.emailjs.com/admin/integration) → Servicios
2. Busca `service_f0e608c`
3. Clic en **"Reconnect"**
4. Autoriza Gmail
5. ¡Listo!

El usuario se crea correctamente en Firebase incluso si el email falla, así que no hay pérdida de datos.

