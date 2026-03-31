---
title: "Bypass de filtros SSRF usando redirecciones DNS personalizadas"
date: "24 Mar, 2026"
category: "Web App"
readTime: "3 min"
---

Ayer durante una auditoría me encontré con un panel de control que permitía exportar reportes a un webhook externo (clásico vector de **SSRF**).  

El problema es que el backend bloqueaba peticiones a rangos internos (`10.0.0.0/8`, `127.0.0.1`, `169.254.169.254`, etc.) usando una lista negra (blacklist) estricta.

### La Solución: DNS Rebinding / Redirección CNAME

En lugar de intentar bypassear el regex de la IP en la URL, usé mi propio dominio. Configuré un subdominio para que resolviera mediante un registro `A` hacia la IP interna objetivo.

```bash
# Configuramos el dominio en nuestro panel DNS
A   target.midominio.com   127.0.0.1
```

Al enviar el payload http://target.midominio.com/admin, el servidor validó que la URL no contenía IPs prohibidas en texto plano, pasó el filtro de seguridad, pero al realizar la petición HTTP, resolvió nuestro dominio a 127.0.0.1 e impactó contra el panel interno.

Moraleja: Las validaciones de SSRF nunca deben hacerse mediante blacklists de strings, sino resolviendo el host antes de la petición y comprobando la IP final contra la red local.