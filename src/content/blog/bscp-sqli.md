---
titulo: "BSCP - SQL Injection: Explicación y resolución de todos los laboratorios de BurpSuite"
tipo: apuntes
certificacion: BSCP
fecha: 2026-03-24
tags: [Inyección, SQL Injection]
---

En este apartado se realiza un repaso exhaustivo y detallado de SQL Injection, un tipo de vulnerabilidad web que permite a un atacante inyectar en la consulta que utiliza la aplicación web para acceder a su base de datos. El impacto de esta vulnerabilidad es relativo, sin embargo, suele permitir a un atacante lograr lectura completa sobre la base de datos, y en algunos casos, también permite modificar y/o borrar datos a dicho atacante. Además, permite en muchos casos comprometer el servidor y lograr escalada lateral, también puede provocar DoS (Denial of Service) sobre el servidor.

---

### ¿Cómo detectar SQL injection?
Se pueden utilizar herramientas y escaneos automaticos que detecten si existe o no SQL injection. Sin embargo, para detecarlo manualmente hay que comprender como se comunica la aplicacion web con la base de datos, de forma que detectemos parámetros que realicen consultas a la base de datos y probar a inyectar "canarios" y observar el comportamiento de la aplicacion web. Los "canarios" tipicos que se suelen utilzar son los siguientes:
- El caracter (') para ver si se detectan errores o anomalías.
- Sintaxis SQL para evaluar el valor original del punto de entrada y un valor diferente para ver si ocurren cambios en la aplicación web.
- Condiciones booleanas como ``OR 1=1`` y ``OR 1=2``, y buscar diferencias en las respuestas de la aplicación web.
- Payloads diseñados exclusivamente para realizar "delays" cuando se ejecuta la query SQL y confirmar que dichos "delays" ocurren en la aplicación web.
- Out-Of-Band payloads

Estos son los casos más comunes de detectar SQL injection, y además concuerdan con los tipos de SQL injections que existen (entraremos en más detalle mientras avanzamos).

### Ejemplo sencillo para entender el concepto
Vamos a resolver un ejemplo sencillo para entender exactamente todo el proceso de explotación de una vulnerabilidad SQL injection. Para ello vamos a resolver el laboratorio **SQL injection vulnerability in WHERE clause allowing retrieval of hidden data** de BurpSuite Academy.

En el enunciado se describe que estamos ante un laboratorio que contiene una vulnerabilidad SQL Injection en el filtro de la categoría de productos. Esto significa que el usuario tiene la capacidad de controlar el input que se le pasa al servidor mediante el parámetro *category*, y además, el valor de dicho parámetro no está teniendo una validación correcta desde el servidor y se está inyectando directamente en la query que realiza la consulta a la base de datos para obtener los productos filtrados. Un ejemplo de uso légitimo sería el siguiente:

![Ejemplo légitimo del sistema](./images/SQLI1.png)

La idea de explotación es que controlamos el valor que se inserta directamente en la consulta SQL. En este caso, el valor del parámetro *filter* se inyecta en la consulta que la base de datos ejecuta para obtener los productos de una categoría:

```sql
SELECT * FROM products
WHERE category = 'INPUT_USUARIO' AND realised = 1
```

El objetivo del laboratorio es mostrar todos los productos, no solo los que pertenecen a una categoría concreta y tienen *realised = 1*.

Para entender cómo lograrlo, hay que tener en cuenta cómo se evalúa la cláusula *WHERE*: la base de datos revisa las filas una por una y comprueba si se cumple la condición. Por ejemplo, compara el campo *category* de cada fila con el valor indicado en el *WHERE*, si coinciden, esa comparación devuelve **TRUE**, y si no, **FALSE**. Además, también se comprueba que *realised = 1*. Cada condición se evalúa de forma atómica y después se aplica el operador **AND**, de modo que solo se devuelven las filas en las que ambas condiciones son **TRUE**.

Como atacantes podemos inyectar contenido en la consulta. Por tanto, la pregunta es: ¿qué condición haría que el *WHERE* devolviera **TRUE** siempre, independientemente del valor de los campos? La respuesta es utilizar el operador **OR** junto con una condición que sea siempre verdadera. Así, aunque la comparación de *category* sea falsa, **FALSE OR TRUE** devuelve **TRUE**, y la fila se selecciona.

Una condición siempre verdadera puede ser, por ejemplo, **1=1**. Para que la inyección sea válida, debemos preservar la sintaxis de la consulta. Como estamos inyectando después de una comilla simple, primero cerramos el literal de cadena original, añadimos **OR 1=1** y comentamos el resto de la consulta. Un payload habitual sería:

```sql
' OR 1=1 -- -
``` 
La consulta resultante quedaría así:
```sql
SELECT * FROM products
WHERE category = '' OR 1=1 -- -' AND realised = 1
```

De este modo, **OR 1=1** hace que la condición sea verdadera para todas las filas, y el comentario `-- -` elimina el resto de la consulta original, incluyendo el **AND realised = 1**. Por eso se devuelven todos los productos, incluso los que tienen *realised = 0*.

Es importante destacar que comentar el resto de la consulta es necesario si queremos obtener todos los productos. Si no se comentara, la consulta quedaría como:

```sql
WHERE category = '' OR 1=1 AND realised = 1
```

y, por la precedencia de operadores, se interpretaría como:

```sql
category = '' OR (1=1 AND realised = 1)
```

Por tanto, no devolvería necesariamente todos los productos, sino solo aquellos que cumplieran *realised = 1*. Al comentar el **AND realised = 1**, eliminamos esa restricción.

Por último, la sintaxis del comentario puede variar según el motor de base de datos. En **MySQL**, `-- -` funciona porque `--` requiere un espacio después, también puede usarse `#`. En otros motores suele bastar con `--` seguido de un espacio. Si el payload se envía por URL, además habría que codificar convenientemente espacios y comillas.