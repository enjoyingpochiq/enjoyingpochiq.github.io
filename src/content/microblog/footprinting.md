---
title: "Footprinting: El arte de mapear la superficie de ataque"
date: "2026-04-01"
category: "Enumeración"
tags: ["HTB Academy", "Infraestructure Enumeration", "Host Enumeration", "Remote Management Protocols"]
readTime: "10 min"
---

Acabo de terminar el modulo de **Footprinting** de la academia de HackTheBox durante mi proceso de preparación para la CPTS (Certified Penetration Tester Specialist), y gracias a este modulo he aprendido la importancia de hacer enfasis en el proceso de enumeración dentro de la metodología.

Voy a dejar documentada mi metodología personal y los vectores de enumeración que he ido recopilando para los servicios más comunes.

---

### La mentalidad durante el Footprinting

Antes de nada, debemos entender que es el Footprinting, para ello voy a tratar de dar una definición lo más precisa posible. Sin embargo, me gustaría mencionar que dependiendo de a quien preguntes esta definición puede variar, ya que en muchos casos la diferencia entre Footprinting, Reconocimiento y Enumeración puede ser un poco ambigua.

El Footprinting es la primera fase del pentesting y engloba desde el reconocimiento tanto pasivo, es decir de información accesible públicamente sin necesidad de interactuar con el sistema, hasta el reconocimiento activo y su posterior enumeración. El objetivo principal de este proceso es lograr recopilar la mayor cantidad de información, para posteriormente tratar de obtener acceso con ella.

Para ello debemos tratar de responder tres preguntas clave:

1. **¿Qué servicios están expuestos?**
2. **¿Qué versiones exactas están ejecutandose?**
3. **¿Existen configuraciones débiles o malas en dichos servicios?**

Además, este proceso de enumeración puede ser dividido en tres niveles diferentes de precisión:

1. **Enumeración basada en la Infraestructura**
2. **Enumeración basada en el Host**
3. **Enumeración basada en el Sistema Operativo**

Y desde un punto de vista más cercano se pueden diferenciar las siguientes capas:

| Capa | Descripción | Categorías de Información |
| :--- | :--- | :--- |
| **1. Presencia en Internet** | Identificación de la infraestructura accesible externamente. | Dominios, Subdominios, vHosts, ASN, Netblocks, IPs, Nubes, Seguridad. |
| **2. Gateway (Puerta de enlace)** | Identificación de medidas de seguridad perimetrales e internas. | Firewalls, DMZ, IPS/IDS, EDR, Proxies, NAC, Segmentación, VPN, Cloudflare. |
| **3. Servicios Accesibles** | Interfaces y servicios alojados externa o internamente. | Tipo de servicio, Funcionalidad, Configuración, Puerto, Versión, Interfaz. |
| **4. Procesos** | Procesos internos, orígenes y destinos asociados a los servicios. | PID, Datos procesados, Tareas, Origen, Destino. |
| **5. Privilegios** | Permisos internos y privilegios sobre los servicios accesibles. | Grupos, Usuarios, Permisos, Restricciones, Entorno. |
| **6. Configuración del SO** | Identificación de componentes internos y setup del sistema. | Tipo de SO, Nivel de parches, Configuración de red, Archivos sensibles. |


### Enumeración basada en la Infraestructura

#### Información del Dominio

El reconocimiento de dominio no consiste solo en sacar una lista de subdominios, sino en entender cómo funciona la empresa y  qué tecnologías necesita para operar. En la fase pasiva, actuamos como "clientes fantasmas", y realizamos un mapeo de la superficie de ataque sin enviar un solo paquete malicioso a los servidores de la empresa.

##### 1. Certificate Transparency

El primer paso es analizar los certificados SSL/TLS. Gracias al estándar *Certificate Transparency*, todas las autoridades certificadoras guardan un registro público de los certificados emitidos. Consultando bases de datos como `crt.sh`, podemos extraer subdominios que de otra forma serían invisibles.

```bash
# Extraer subdominios únicos de crt.sh en formato limpio
curl -s [https://crt.sh/](https://crt.sh/)\?q\=inlanefreight.com\&output\=json | jq . | grep name | cut -d":" -f2 | grep -v "CN=" | cut -d'"' -f2 | awk '{gsub(/\\n/,"\n");}1;' | sort -u
```

##### 2. Resolución y Filtrado (Shodan)

Una vez tenemos a lista de subdominios, debemos traducirlos a direcciones IP.

Debemos identificar qué IPs pertenecen realmente a la empresa y cuáles son de proveedores de terceros (AWS, Cloudflare), ya que estas últimas suelen estar fuera del alcance legal del Pentest. Las IPs que sean propiedad de la empresa se pueden pasar por Shodan para identificar pasivamente puertos abiertos (SSH, paneles web, dispositivos IoT) sin lanzar un escaneo activo de Nmap.

##### 3. Análisis de Registros DNS

Una simple consulta completa al DNS nos revela la columna vertebral de la infraestructura tecnológica de la empresa.

```bash
# Extraer todos los registros DNS disponibles
dig any dominio.com
```

Al analizar la respuesta, cada registro cuenta una historia diferente:

 - A Records: Nos dan las direcciones IP directas de los hosts.
 
 - NS Records: Revelan los servidores de nombres, lo que a menudo expone al proveedor de hosting principal.
 
 - MX Records: Indican quién gestiona el correo. Si vemos aspmx.l.google.com, sabemos que usan Google Workspace (posibles Google Drives expuestos). Si vemos Outlook, es probable que usen Office 365, Azure AD y Sharepoint.

 Los registros TXT se usan para verificar la propiedad del dominio ante herramientas de terceros y para configurar la seguridad del correo (SPF, DMARC, DKIM). Analizar estos textos planos nos permite hacer ingeniería inversa de su stack tecnológico interno:

 - Atlassian (atlassian-domain-verification): Nos chiva que utilizan herramientas como Jira, Confluence o Bitbucket para su desarrollo.

 - LogMeIn (logmein-verification-code): Tienen un sistema de gestión de acceso remoto centralizado (un objetivo de altísimo valor si logramos comprometer credenciales).

 - Mailgun / Sendgrid: La empresa utiliza servicios de envío de correos, lo que significa que existen APIs e interfaces web (potenciales vectores de SSRF o IDOR).

 - SPF (v=spf1): La regla del Sender Policy Framework es vital, ya que a menudo los administradores incluyen directamente direcciones IP internas o rangos de red de confianza que tienen permiso para enviar correos.

#### Recursos Cloud

Hoy en día, es raro encontrar una infraestructura que no dependa en cierta medida de la nube (AWS, Azure o GCP). Sin embargo, que la infraestructura base de Amazon o Microsoft sea segura no significa que la configuración de la empresa lo sea.

Uno de los vectores de entrada inicial más comunes y devastadores son los almacenamientos en la nube mal configurados (S3 Buckets en AWS, Blobs en Azure o Cloud Storage en GCP) que permiten acceso de lectura sin autenticación. En la fase de reconocimiento pasivo, nuestro objetivo es encontrarlos antes de tocar el servidor principal.

##### 1. Rastros en el DNS y Código Fuente

A menudo, los administradores mapean sus buckets de almacenamiento en sus propios registros DNS por comodidad. Si al resolver subdominios ves algo que apunta a `s3-website-us-west-2.amazonaws.com`, ya tienes un hilo del que tirar.

Además, no hace falta lanzar escáneres agresivos para encontrar estos enlaces. Una simple inspección del código fuente (HTML/JS) de la web principal suele revelar buckets utilizados para alojar *assets* estáticos:

```html
<img src="[https://empresa-assets.s3.amazonaws.com/logo.png](https://empresa-assets.s3.amazonaws.com/logo.png)" />
<script src="[https://storage.googleapis.com/empresa-prod-js/app.js](https://storage.googleapis.com/empresa-prod-js/app.js)"></script>
```

##### 2. Google Dorking para la Nube

Google indexa constantemente el contenido de los buckets públicos. Utilizando Google Dorks podemos filtrar resultados para encontrar documentos confidenciales expuestos por la empresa objetivo.

```Plaintext
# Búsqueda de buckets de S3 indexados que contengan el nombre de la empresa
site:s3.amazonaws.com intext:"EmpresaTarget"

# Búsqueda de blobs en Azure con archivos PDF o de texto
site:blob.core.windows.net inurl:"EmpresaTarget" ext:pdf | ext:txt
```

##### 3. Herramientas OSINT Especializadas

Para no depender únicamente de Google, existen servicios de terceros que escanean y catalogan masivamente estas infraestructuras en la nube.

 - Domain.Glass: Excelente para obtener una visión general de la infraestructura externa. No solo nos revela subdominios, sino que a menudo identifica las medidas de seguridad perimetrales (Capa 2 del Reconocimiento), como si la web está protegida por el WAF de Cloudflare.
 
 - GrayHatWarfare: Es el buscador por excelencia de buckets públicos. Permite buscar por palabras clave (como el nombre de la empresa o sus abreviaturas internas) y filtrar directamente por extensiones de archivo críticas (.pem, .sql, .env).


#### Staff

A menudo pensamos que el reconocimiento pasivo se limita a escanear subdominios y buscar IPs, pero la fuente de información más rica sobre la infraestructura interna de una empresa no está en sus servidores, sino en sus empleados. 

Mediante el análisis de redes sociales profesionales (como LinkedIn o Xing) y plataformas de empleo, podemos hacer ingeniería inversa de la tecnología que utilizan, los lenguajes de programación en los que desarrollan e incluso las medidas de seguridad que tienen implementadas.

##### 1. Ofertas de empleo

Cuando una empresa publica una oferta de trabajo, básicamente está publicando un manual detallado de su infraestructura interna.

Si leemos entre líneas los requisitos técnicos de una oferta (por ejemplo, para un puesto de Backend), podemos extraer conclusiones tácticas inmediatas:

* **"Experiencia con Flask, Django o ASP.NET":** Nos acota enormemente los vectores de ataque web. Si usan Django, buscaremos vulnerabilidades específicas de Python y misconfiguraciones comunes (como las descritas en el OWASP Top 10 para Django).
* **"Uso de PostgreSQL y Oracle":** Ya sabemos a qué puertos y servicios apuntar si logramos acceso interno o encontramos una inyección SQL.
* **"Familiaridad con Atlassian suite (Confluence, Jira, Bitbucket)":** Nos indica que la empresa tiene portales de documentación internos. Estas plataformas a menudo sufren vulnerabilidades críticas (RCEs en Confluence son un clásico) o tienen configuraciones de permisos laxas.

##### 2. Perfilado de empleados

Las empresas contratan talento para aplicar sus habilidades al negocio. Por tanto, el perfil público de un empleado es un reflejo directo de la tecnología interna de la empresa.

Al usar los filtros avanzados de LinkedIn (por rol, industria, ubicación), podemos perfilar dos tipos de objetivos estratégicos:
1. **Desarrolladores e Ingenieros:** Sus publicaciones sobre certificaciones, proyectos actuales o problemas técnicos que han resuelto en foros nos revelan la arquitectura del software.
2. **Personal de Seguridad (Blue Team):** Si la empresa busca o tiene empleados certificados en tecnologías específicas (ej. Splunk, CrowdStrike, AWS Security), nos están chivando exactamente qué herramientas EDR, SIEM o WAF nos vamos a encontrar cuando intentemos la intrusión.

##### 3. Repositorios públicos y fugas de secretos

Mostrar proyectos personales en GitHub es vital para hacer *networking*, pero la línea entre el código personal y el código corporativo a veces se difumina peligrosamente.

Es común que los desarrolladores:
* Utilicen los mismos patrones de diseño y estructura de carpetas en sus proyectos públicos que en la empresa.
* Suban por error fragmentos de código, *scripts* de automatización o archivos de configuración (`.env`).
* En el peor de los casos, **filtren secretos directamente en el código fuente público**. Un análisis profundo de los repositorios de un empleado puede revelar direcciones de correo personales ocultas, credenciales de bases de datos o *tokens JWT hardcodeados* que abren la puerta a la infraestructura de la empresa sin lanzar un solo exploit.