# Configuración de EmailJS para GestiónPro

## Datos actuales

- Service ID: `service_161dv6f`
- Template ID creación de cuenta: `template_njhbffj`
- Template ID recordatorio de pago: `template_fheag2h`
- Public Key: `QLg98FNv2a5z4ZK77`
- Correo de contacto: `gestionproinfo@gmail.com`

## Template de creación de cuenta

Variables esperadas:

- `{{to_name}}`
- `{{to_email}}`
- `{{user_email}}`
- `{{user_password}}`
- `{{login_url}}`
- `{{app_name}}`
- `{{email}}`
- `{{reply_to}}`
- `{{contact_email}}`

## Template de recordatorio de pago

Variables esperadas:

- `{{to_email}}`
- `{{to_name}}`
- `{{business_name}}`
- `{{plan}}`
- `{{precio_mensual}}`
- `{{proximo_pago}}`
- `{{ultimo_pago}}`
- `{{payment_status}}`
- `{{payment_notes}}`
- `{{login_url}}`
- `{{app_name}}`
- `{{email}}`
- `{{reply_to}}`
- `{{title}}`

## Notas

- No usar Private Key en frontend.
- El envío debe usar siempre la Public Key.
- El recordatorio de pago no debe incluir contraseña.
