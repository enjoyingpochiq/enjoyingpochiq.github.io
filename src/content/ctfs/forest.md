---
machine: "Forest"
platform: "HackTheBox"
os: "Windows"
difficulty: "Fácil"
diffColor: "text-green-400 bg-green-400/10 border-green-400/20"
date: "15 Mar, 2026"
tags: ["Active Directory", "AS-REP Roasting", "BloodHound", "DCSync"]
---

Forest es una excelente máquina introductoria para ataques contra Active Directory. La intrusión inicial se basa en la enumeración de usuarios mediante SMB/RPC y un ataque de AS-REP Roasting. Para la escalada de privilegios, explotaremos permisos excesivos (GenericAll) mapeados con BloodHound para realizar un ataque DCSync.

## 1. Enumeración (Recon)

Comenzamos con un escaneo de puertos estándar usando Nmap. Observamos los puertos típicos de un Controlador de Dominio (DNS, Kerberos, SMB, LDAP).

```bash
nmap -p- --open -sS --min-rate 5000 -n -Pn 10.10.10.161
```

A través de una conexión anónima (Null Session) mediante rpcclient, logramos enumerar la lista de usuarios del dominio htb.local.

## 2. Intrusión Inicial (AS-REP Roasting)

Con la lista de usuarios válida, utilizamos GetNPUsers.py de Impacket para identificar si algún usuario tiene la propiedad Do not require Kerberos preauthentication habilitada.

```bash
GetNPUsers.py htb.local/ -usersfile users.txt -format hashcat -outputfile hashes.txt -dc-ip 10.10.10.161
```

Obtenemos el hash del usuario svc-alfresco. Lo crackeamos con Hashcat y conseguimos acceso al sistema mediante WinRM.

## 3. Escalada de Privilegios

Tras subir el recolector de BloodHound (SharpHound.exe) y analizar los resultados, observamos que el grupo Exchange Windows Permissions (del cual somos miembros indirectos) tiene privilegios WriteDacl sobre el dominio.

Abusamos de esto para darnos privilegios de replicación (DCSync) y volcamos los hashes del administrador:

```bash
secretsdump.py htb.local/svc-alfresco:password@10.10.10.161 -just-dc-user Administrator
```

Con el hash NTLM del administrador en nuestro poder, realizamos un Pass-The-Hash mediante psexec.py y obtenemos una shell como NT AUTHORITY\SYSTEM.