---
title: "Footprinting: El arte de mapear la superficie de ataque"
date: "24 Mar, 2026"
category: "Enumeración"
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

### Enumeración basada en el Host

Una vez tengamos suficiente información relevante de como esta estructurada la infraestructura, comenzamos a realizar el reconocimiento y enumeración sobre los hosts encontrados. En dichos hosts, vamos a encontrar diferentes servicios, y a partir de estos servicios nuestro objetivo es tratar de obtener la mayor cantidad de información sobre ellos, ya sea de forma pasiva o activa. En este caso, nos vamos a centrar principalmente en una enumeración activa, esto significa que vamos a interactuar directamente con el sistema.

#### FTP (File Transfer Protocol)

##### ¿Qué es?

File Transfer Protocol, o en español Protocolo de Transferencia de Archivos es un protocolo de red estándar utilizado para transferir archivos de un host a otro a través de una red basada en TCP. Opera en un modelo *cliente-servidor* y permite a los usuarios subir, descargar y navegar por el sistema de archivos de un servidor remoto.

Al ser un protocolo antiguo, su mayor debilidad es que **transmite la información en texto plano** (incluidas las credenciales). Soporta tanto acceso autenticado (usuario y contraseña) como acceso anónimo.

##### Formas de conexión

Dependiendo del entorno y de las herramientas disponibles en nuestra máquina atacante, podemos interactuar con el servidor de varias formas:

```bash
# 1. Cliente FTP Estándar (El puerto 21 es opcional por defecto)
ftp <target-ip>

# 2. Usando lftp (Una versión mejorada, con soporte para comandos avanzados)
lftp <target-ip>

# 3. Vía Navegador Web
ftp://usuario:password@<target-ip>
```
##### Reconocimiento y Enumeración (Recon)

Antes de lanzar cualquier ataque, debemos entender a qué nos enfrentamos. Para ello vamos a realizar una serie de técnicas que nos van a permitir obtener información valiosa como la versión.

1. **Identificación y Banner Grabbing**: Podemos usar Netcat para capturar el "mensaje de bienvenida" (Banner) del servicio: Esto a menudo nos revela el software exacto y la versión que está corriendo.

```bash
# Escaneo de puerto con Nmap
nmap -p 21 <target-ip>

# Banner Grabbing manual con Netcat
nc -nv <target-ip> 21
```

2. **Enumeración de características**: Los servidores FTP tienen distintas capacidades. El comando FEAT lista qué características adicionales soporta el servidor. Podemos automatizar esto con Nmap:

```bash
nmap -p 21 --script ftp-features <target-ip>
```

3. **Fuzzing de Directorios FTP**: Muchos servidores tienen directorios ocultos o por defecto que contienen información sensible. Podemos forzar su descubrimiento usando herramientas de fuzzing de directorios web aplicadas al protocolo FTP:

```bash
gobuster dir -u ftp://<target-ip> -w /usr/share/seclists/Discovery/Web-Content/common.txt
```

##### Vectores de ataque

1. **Autenticación Anónima (Anonymous Login)**: El vector más básico pero sorprendentemente común. Permite a cualquier usuario acceder sin una identidad específica para descargar archivos públicos.
 - Usuario: anonymous o ftp
 - Contraseña: (Cualquiera o dejar en blanco)

2. **Credenciales por Defecto**: Si el acceso anónimo está deshabilitado, el siguiente paso (mucho más silencioso que un bruteforce) es probar credenciales por defecto o comunes como admin:admin, root:root, administrator:password o ftpuser:test.

3. **Fuerza Bruta (Bruteforcing)**: Si lo anterior falla, podemos realizar ataques de diccionario contra el servicio utilizando herramientas especializadas.

```bash
# Fuerza bruta usando Hydra (Ataque de diccionario)
hydra -L users.txt -P pass.txt -f ftp://<target-ip>

# Fuerza bruta usando scripts de Nmap
nmap -p 21 --script ftp-brute <target-ip>
```

4. **FTP Bounce Attack (Ataque de Rebote)**: Esta es una técnica avanzada que explota la capacidad del protocolo FTP para redirigir tráfico, enmascarando el origen del atacante. Utiliza el comando PORT del servidor FTP para enrutar datos hacia una tercera máquina, haciendo que el ataque parezca originarse desde el propio servidor FTP.

```bash
# Escaneo de red rebotado a través de Nmap
# Hace parecer que el escaneo proviene del <FTP_server>
nmap -b <FTP_server>:<port> <target_network>
```
Finalmente, es importante que en base a la versión descubierta, se realice una investigación sobre la posible existencia de vulnerabilidades públicas conocidas.

##### Post-Explotación

Una vez dentro, el objetivo es extraer información de valor o ganar ejecución de comandos en el servidor subyacente.

**Comandos (Cheat Sheet)**

| Comando | Descripción | Ejemplo de uso |
| :--- | :--- | :--- |
| **lcd** | Cambia el directorio en tu máquina LOCAL | lcd /home/kali/loot |
| **cd** | Cambia el directorio en el servidor REMOTO | cd /var/www/html |
| **ls** | Lista los archivos en el servidor | ls -la |
| **get** | Descarga un archivo del servidor | get config.php |
| **mget** | Descarga múltiples archivos | mget *.txt |
| **put** | Sube un archivo al servidor | put exploit.php |
| **mput** | Sube múltiples archivos | mput *.php |
| **bin / ascii** | Cambia el modo de transferencia (Binario para ejecutables/zip, ASCII para texto) | bin |

**Descarga Masiva (Exfiltración rápida)**
Para no ir archivo por archivo, podemos usar wget para clonar el directorio FTP completo de forma recursiva:

```bash
wget -m ftp://anonymous:anonymous@<target-ip>
```

**Escalada: Reverse Shell a través de la Web**
Si el servidor FTP comparte directorio con el servidor Web (por ejemplo, tenemos acceso de escritura en /var/www/html) y el servidor soporta PHP, podemos subir un payload para obtener una shell interactiva.
