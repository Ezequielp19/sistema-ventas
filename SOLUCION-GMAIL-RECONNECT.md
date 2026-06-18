# ðŸ”§ SoluciÃ³n: Reconectar Gmail en EmailJS

## ðŸš¨ Error Detectado

```
Gmail_API: Invalid grant. Please reconnect your Gmail account
```

Este error indica que la conexiÃ³n de Gmail API en EmailJS ha expirado o necesita ser reconectada.

## âœ… SoluciÃ³n Paso a Paso

### 1. Acceder a EmailJS Dashboard

1. Ve a [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Inicia sesiÃ³n con tu cuenta

### 2. Reconectar el Servicio de Gmail

1. En el menÃº lateral, haz clic en **Email Services** o **Integrations**
2. Busca el servicio con ID: `service_161dv6f`
3. VerÃ¡s un botÃ³n que dice **"Reconnect"** o **"Reconectar"** (generalmente en rojo o con un Ã­cono de advertencia)
4. Haz clic en **"Reconnect"**

### 3. Autorizar Gmail Nuevamente

1. Se abrirÃ¡ una ventana de Google OAuth
2. Selecciona la cuenta de Gmail que quieres usar
3. Haz clic en **"Permitir"** o **"Allow"** para autorizar el acceso
4. Espera a que se complete la conexiÃ³n

### 4. Verificar la ConexiÃ³n

1. DespuÃ©s de reconectar, verifica que el estado del servicio muestre **"Connected"** o **"Conectado"**
2. DeberÃ­as ver un indicador verde o un checkmark
3. El servicio deberÃ­a estar listo para enviar emails

## ðŸ”„ Alternativa: Recrear el Servicio

Si la reconexiÃ³n no funciona, puedes recrear el servicio:

### OpciÃ³n 1: Usar el mismo ID

1. Elimina el servicio actual `service_161dv6f`
2. Crea un nuevo servicio de Gmail
3. Asigna el mismo ID: `service_161dv6f`
4. Conecta tu cuenta de Gmail
5. Vincula el servicio al template `template_njhbffj`

### OpciÃ³n 2: Actualizar el ID en el cÃ³digo

1. Crea un nuevo servicio de Gmail en EmailJS
2. Anota el nuevo Service ID
3. Actualiza el cÃ³digo en `components/super-admin-panel.tsx`:

```typescript
const EMAILJS_SERVICE_ID = "service_161dv6f"
const ACCOUNT_CREATION_TEMPLATE_ID = "template_njhbffj"
const EMAILJS_PUBLIC_KEY = "QLg98FNv2a5z4ZK77"
```

## ðŸ” Verificar que Funciona

1. Intenta crear un nuevo usuario desde el panel de super administrador
2. Revisa la consola del navegador - no deberÃ­a haber errores 412
3. Verifica que recibas el email en la direcciÃ³n especificada

## âš ï¸ Notas Importantes

### Â¿Por quÃ© expira la conexiÃ³n?

- Las conexiones OAuth de Gmail pueden expirar por seguridad
- Si cambias la contraseÃ±a de Gmail, la conexiÃ³n se invalida
- Google puede revocar permisos por inactividad
- Cambios en la configuraciÃ³n de seguridad de Google pueden invalidar la conexiÃ³n

### PrevenciÃ³n

- Revisa periÃ³dicamente el estado de los servicios en EmailJS
- Configura alertas en EmailJS si estÃ¡n disponibles
- MantÃ©n un registro de cuÃ¡ndo se reconectÃ³ el servicio

## ðŸ†˜ Si el Problema Persiste

### Verificar Permisos de Gmail

1. Ve a [Google Account Security](https://myaccount.google.com/security)
2. Revisa las **"Third-party apps with account access"**
3. Busca EmailJS en la lista
4. Si no aparece o estÃ¡ deshabilitado, reconÃ©ctalo desde EmailJS

### Verificar LÃ­mites de Gmail

1. Gmail tiene lÃ­mites de envÃ­o diarios
2. Verifica que no hayas excedido el lÃ­mite
3. Revisa en EmailJS Dashboard si hay mensajes sobre lÃ­mites

### Contactar Soporte

Si nada funciona:

1. Contacta el soporte de EmailJS: [support@emailjs.com](mailto:support@emailjs.com)
2. Menciona el error: `Gmail_API: Invalid grant`
3. Proporciona el Service ID: `service_161dv6f`
4. Incluye capturas de pantalla del error

## ðŸ“‹ Checklist de VerificaciÃ³n

Antes de intentar enviar emails nuevamente:

- [ ] El servicio `service_161dv6f` estÃ¡ conectado (estado verde)
- [ ] La cuenta de Gmail estÃ¡ autorizada
- [ ] El template `template_njhbffj` estÃ¡ vinculado al servicio
- [ ] No hay errores en el dashboard de EmailJS
- [ ] Los lÃ­mites de Gmail no estÃ¡n excedidos

## ðŸŽ¯ SoluciÃ³n RÃ¡pida

**Pasos rÃ¡pidos para reconectar:**

1. [Dashboard EmailJS](https://dashboard.emailjs.com/admin/integration) â†’ Servicios
2. Busca `service_161dv6f`
3. Clic en **"Reconnect"**
4. Autoriza Gmail
5. Â¡Listo!

El usuario se crea correctamente en Firebase incluso si el email falla, asÃ­ que no hay pÃ©rdida de datos.


