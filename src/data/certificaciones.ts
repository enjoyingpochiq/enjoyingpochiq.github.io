// Tus certificaciones. Para ponerlas al día solo hay que tocar este fichero:
//  - estado: 'obtenida', 'en-curso' o 'pendiente';
//  - en la que estás preparando, marca cada módulo con hecho: true según los termines.
// El porcentaje y la línea de «preparando…» de la portada se calculan solos.

export type EstadoCertificacion = 'obtenida' | 'en-curso' | 'pendiente';

export interface Certificacion {
  id: string; // corto y sin espacios: se usa para enlazar con tus apuntes (certificacion: CPTS en la nota)
  nombre: string;
  emisor: string;
  estado: EstadoCertificacion;
  año?: number;
  credencial?: string;
  modulos?: { nombre: string; hecho: boolean }[];
}

export const certificaciones: Certificacion[] = [
  {
    id: 'ejpt',
    nombre: 'eJPT v2',
    emisor: 'INE Security',
    estado: 'obtenida',
    año: 2025,
    credencial: 'https://certs.ine.com/69743748-8cf3-409a-8760-401c4ca2e731#acc.sRrcuaHo',
  },
  {
    id: 'cpts',
    nombre: 'CPTS',
    emisor: 'Hack The Box',
    estado: 'en-curso',
    modulos: [
      { nombre: 'Penetration Testing Process', hecho: true },
      { nombre: 'Getting Started', hecho: true },
      { nombre: 'Network Enumeration with Nmap', hecho: true },
      { nombre: 'Footprinting', hecho: true },
      { nombre: 'Information Gathering - Web Edition', hecho: true },
      { nombre: 'Vulnerability Assessment', hecho: false },
      { nombre: 'File Transfers', hecho: true },
      { nombre: 'Shells & Payloads', hecho: false },
      { nombre: 'Using the Metasploit Framework', hecho: false },
      { nombre: 'Password Attacks', hecho: false },
      { nombre: 'Attacking Common Services', hecho: false },
      { nombre: 'Pivoting, Tunneling, and Port Forwarding', hecho: false },
      { nombre: 'Active Directory Enumeration & Attacks', hecho: false },
      { nombre: 'Using Web Proxies', hecho: false },
      { nombre: 'Attacking Web Applications with Ffuf', hecho: false },
      { nombre: 'Login Brute Forcing', hecho: false },
      { nombre: 'SQL Injection Fundamentals', hecho: false },
      { nombre: 'SQLMap Essentials', hecho: false },
      { nombre: 'Cross-Site Scripting (XSS)', hecho: false },
      { nombre: 'File Inclusion', hecho: false },
      { nombre: 'File Upload Attacks', hecho: false },
      { nombre: 'Command Injections', hecho: false },
      { nombre: 'Web Attacks', hecho: false },
      { nombre: 'Attacking Common Applications', hecho: false },
      { nombre: 'Linux Privilege Escalation', hecho: false },
      { nombre: 'Windows Privilege Escalation', hecho: false },
      { nombre: 'Documentation & Reporting', hecho: false },
      { nombre: 'Attacking Enterprise Networks', hecho: false },
    ],
  },
  {
    id: 'crtp',
    nombre: 'CRTP',
    emisor: 'Altered Security',
    estado: 'pendiente',
  },
  {
    id: 'bscp',
    nombre: 'BSCP',
    emisor: 'PortSwigger',
    estado: 'pendiente',
  },
];
