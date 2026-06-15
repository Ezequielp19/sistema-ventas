# 🔐 Configuración de Reglas de Seguridad de Firebase Realtime Database

## 🚨 Problema

Si estás recibiendo el error `PERMISSION_DENIED: Permission denied` al intentar guardar usuarios desde el panel de super administrador, necesitas configurar las reglas de seguridad de Firebase Realtime Database.

## ✅ Solución

### Paso 1: Acceder a Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: `app-servicios-e99de`
3. En el menú lateral, haz clic en **Realtime Database**
4. Ve a la pestaña **Reglas** (Rules)

### Paso 2: Configurar las Reglas

Copia y pega las siguientes reglas en el editor de reglas:

```json
{
  "rules": {
    "usuarios": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "tiendas": {
      ".read": "auth != null",
      "$userId": {
        ".write": "auth != null || auth.uid == $userId"
      }
    },
    "empresas": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### Paso 3: Publicar las Reglas

1. Haz clic en el botón **Publicar** (Publish)
2. Espera a que se confirme la publicación

## 📋 Explicación de las Reglas

### Regla para `usuarios`:
- **Lectura (`.read`)**: Permite leer a cualquier usuario autenticado
- **Escritura (`.write`)**: Permite escribir a cualquier usuario autenticado

### Regla para `tiendas`:
- **Lectura (`.read`)**: Permite leer a cualquier usuario autenticado
- **Escritura por usuario**: Permite escribir al propietario de la tienda o a cualquier usuario autenticado

### Regla para `empresas`:
- **Lectura (`.read`)**: Permite leer a cualquier usuario autenticado
- **Escritura (`.write`)**: Permite escribir a cualquier usuario autenticado

## 🔒 Opciones de Seguridad Adicionales

Si quieres una configuración más restrictiva, puedes usar estas reglas:

```json
{
  "rules": {
    "usuarios": {
      ".read": "auth != null",
      ".write": "auth != null && (auth.token.email == 'adminatenea@software.com' || auth.uid != null)"
    },
    "tiendas": {
      ".read": true,
      "$userId": {
        ".write": "auth != null && (auth.uid == $userId || auth.token.email == 'adminatenea@software.com')"
      }
    }
  }
}
```

## ⚠️ Nota Importante

**Para desarrollo/testing**, puedes usar reglas más permisivas temporalmente:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

⚠️ **ADVERTENCIA**: Estas reglas permiten acceso completo a cualquier persona. **NO uses estas reglas en producción**.

## 🧪 Verificar las Reglas

Después de configurar las reglas:

1. Intenta guardar un usuario desde el panel de super administrador
2. Si aún recibes el error `PERMISSION_DENIED`, verifica que:
   - El super admin esté autenticado con Firebase Auth (se autentica automáticamente al iniciar sesión)
   - Las reglas se hayan publicado correctamente
   - No haya errores de sintaxis en las reglas

## 🔍 Solución de Problemas

### Error: "Rules are not valid JSON"
- Verifica que el JSON esté bien formateado
- Usa un validador JSON online si es necesario

### Error: "Permission denied" después de configurar las reglas
- Verifica que el usuario esté autenticado: `auth.currentUser != null`
- Revisa la consola del navegador para ver más detalles del error
- Asegúrate de que las reglas se hayan publicado correctamente

### El super admin no puede escribir
- Verifica que la autenticación anónima esté habilitada en Firebase Console:
  - Ve a **Authentication** > **Sign-in method**
  - Habilita **Anonymous** si no está habilitado

## 📚 Recursos Adicionales

- [Documentación de Firebase Realtime Database Rules](https://firebase.google.com/docs/database/security)
- [Guía de Reglas de Seguridad](https://firebase.google.com/docs/database/security/quickstart)

