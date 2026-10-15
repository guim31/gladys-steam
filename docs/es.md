# Steam

## Presentación

Esta integración sigue el **estado de Steam** de las cuentas que usted elija (la suya, la de sus hijos, la de sus amigos): en línea o no, el juego en curso y desde cuándo, el tiempo de juego de las dos últimas semanas, el nivel de Steam y la última desconexión. Cada cuenta se convierte en un dispositivo de Gladys, un widget del panel las muestra todas de un vistazo, y los disparadores de escena permiten a Gladys reaccionar cuando alguien empieza o deja de jugar, se conecta o lleva demasiado tiempo jugando (control parental).

Lee la **API web oficial de Steam** (`api.steampowered.com`) con una clave de API gratuita, solo en lectura: nunca se modifica nada en Steam. Sin afiliación con Valve: Steam es una marca de Valve Corporation.

Desarrollada sin una cuenta de Steam real a mano: sus comentarios son bienvenidos.

## Requisitos

- Gladys Assistant 5.1.0 o posterior.
- Una **clave de API web de Steam**, gratuita: inicie sesión en [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey), introduzca cualquier nombre de dominio (por ejemplo `localhost`) y copie la clave de 32 caracteres. Steam solo da claves a las cuentas que han gastado al menos 5 USD en la tienda.
- Las cuentas a seguir. El **juego actual** solo se ve si el perfil es **público** y sus **detalles de juego** también (Steam: Editar perfil, Configuración de privacidad). Un perfil privado muestra igualmente su estado (en línea, ausente…), nunca su juego.

## Configuración

En Gladys, **Integraciones**, **Steam**, **Configuración**:

| Campo                              | Contenido                                                                                                                                                                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clave de API de Steam              | La clave copiada de steamcommunity.com/dev/apikey. Guardada en la configuración de Gladys, nunca escrita en los registros.                                                                                                                                      |
| Cuentas a seguir                   | Hasta 20, separadas por comas: un SteamID64 (`76561198…`, mostrado en store.steampowered.com/account), una URL de perfil (`https://steamcommunity.com/id/nombre/` o `/profiles/7656…`), un nombre de URL personalizado, o las formas `STEAM_0:1:…` y `[U:1:…]`. |
| Intervalo de actualización         | 30 segundos, 1, 2 o 5 minutos (1 minuto por defecto).                                                                                                                                                                                                           |
| Idioma de los nombres de funciones | Inglés, francés (por defecto), alemán o español: los nombres de las funciones al crearlas, y los textos enviados a las escenas.                                                                                                                                 |

Abra después la pestaña **Descubrimiento** y añada como dispositivos las cuentas que desee. El botón **Comprobar las cuentas**, bajo la configuración, resuelve cada entrada e indica si su perfil es público.

## Dispositivos

Un dispositivo por cuenta, llamado «Steam» seguido del nombre de Steam. Todas las funciones son de solo lectura.

| Función                     | Tipo               | Contenido                                                                                                       |
| --------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Estado                      | Texto              | Desconectado, En línea, Ocupado, Ausente, Durmiendo, Busca intercambio, Busca partida.                          |
| En línea                    | Binario            | 1 cuando la cuenta no está desconectada.                                                                        |
| Jugando                     | Binario            | 1 mientras un juego está abierto (solo perfiles públicos).                                                      |
| Juego actual                | Texto              | El nombre del juego, «Ninguno» si no.                                                                           |
| Sesión de juego             | Duración (minutos) | Duración de la sesión en curso, 0 fuera del juego. Vea «Juega desde hace más de…» para saber qué es una sesión. |
| Tiempo de juego (2 semanas) | Duración (horas)   | Tiempo de juego total de las dos últimas semanas, leído cada 30 minutos.                                        |
| Nivel de Steam              | Contador           | El nivel de Steam, leído cada 30 minutos.                                                                       |
| Última desconexión          | Texto              | Fecha y hora de la última desconexión, en la zona horaria de Gladys.                                            |

Las funciones binarias y de duración se usan en las condiciones de escena de Gladys («Jugando» igual a 1, «Sesión de juego» mayor que 60).

## Widget

**Cuentas de Steam**: dos mosaicos (número de cuentas jugando, cuentas en línea) y una línea por cuenta (diez como máximo): el juego y la duración de la sesión durante una partida, el estado en otro caso, con un color (verde jugando, azul en línea, naranja ocupado o ausente, gris desconectado). Una nota nombra los perfiles privados. El widget muestra la última actualización: nunca consulta Steam por sí mismo.

## Disparadores de escena

Cada disparador puede limitarse a una cuenta (vacío: cualquier cuenta) y pasa el nombre de la cuenta a las acciones de la escena.

| Disparador               | Cuándo                                                                                                                                                                                                                                                                                                                             | Información transmitida                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Empieza a jugar          | Se inicia un juego, o el jugador cambia a otro. Filtro opcional: el nombre exacto del juego.                                                                                                                                                                                                                                       | Nombre de la cuenta, juego, ID de Steam     |
| Deja de jugar            | Termina un juego, o el jugador cambia a otro. Filtro opcional: el juego.                                                                                                                                                                                                                                                           | Nombre de la cuenta, juego, minutos jugados |
| Juega desde hace más de… | La **sesión de juego** alcanza la duración elegida (15, 30, 45 minutos, 1, 1,5, 2, 3 o 4 horas). Una sesión es un tiempo de juego continuo, sea cual sea el juego: cambiar de juego la prolonga, una pausa de menos de 10 minutos también. Se dispara una vez por sesión y por duración, incluso después de un reinicio de Gladys. | Nombre de la cuenta, juego, minutos         |
| Se conecta               | La cuenta pasa de desconectada a cualquier otro estado.                                                                                                                                                                                                                                                                            | Nombre de la cuenta, estado                 |

La primera actualización tras el inicio de la integración solo registra la situación: no dispara nada.

## Acción de escena

**Leer una cuenta de Steam** pasa a los pasos siguientes de la escena el estado, en línea (sí/no), jugando (sí/no), el juego actual y la duración de la sesión de una cuenta. Lee la última actualización, sin consultar Steam: combínela con «Continuar solo si» para actuar solo cuando la cuenta está jugando.

## Acción de configuración

**Comprobar las cuentas** resuelve cada entrada del campo de cuentas y responde, para cada una, el nombre de Steam, el SteamID64 y si el perfil es público, o por qué no se ha encontrado la entrada.

## Ejemplos de escenas

- **Hora de dormir**: cada día de colegio a las 21:00, «Leer una cuenta de Steam» en la cuenta de su hijo, «Continuar solo si» jugando es verdadero, y luego anunciar «Es hora de dejar [juego]» en el altavoz de la casa.
- **Tiempo de pantalla**: disparador «Juega desde hace más de… 2 horas» en la cuenta de su hijo, y luego enviarse un mensaje «Léo lleva 2 horas jugando ([juego])» y bajar la luz de la habitación.
- **Noche de juegos**: disparador «Empieza a jugar» en su cuenta, y luego poner el salón en la escena «Juego» y silenciar las notificaciones.

## Actualización y cuotas de Steam

La integración se actualiza sola al intervalo elegido (no depende del sondeo de Gladys). Una sola solicitud lee todas las cuentas a la vez; el nivel y el tiempo de juego se leen cada 30 minutos, solo para las cuentas añadidas a Gladys. Con el intervalo por defecto y tres cuentas añadidas, son unas 1.700 solicitudes al día, lejos de las **100.000 llamadas al día** permitidas por las [condiciones de uso de la API web de Steam](https://steamcommunity.com/dev/apiterms). Si Steam responde «demasiadas solicitudes» (HTTP 429), la integración hace una pausa de 5 minutos. El propio Steam actualiza el estado con un retraso de unos minutos como máximo.

## Solución de problemas

- **«Steam ha rechazado la clave de API»** en la pantalla de configuración: copie de nuevo la clave de steamcommunity.com/dev/apikey (32 caracteres, sin espacios).
- **No se muestra ningún juego aunque alguien juega**: el perfil, o sus detalles de juego, no son públicos. «Comprobar las cuentas» lo indica, y el widget también.
- **Falta una cuenta en la pestaña Descubrimiento**: compruebe cómo está escrita con «Comprobar las cuentas»; el nombre de URL personalizado es el que sigue a `/id/` en la URL del perfil, no el nombre mostrado.
- **Steam no responde**: la integración conserva los últimos estados conocidos y vuelve a intentarlo en cada intervalo; la pantalla de configuración lo indica.
- **Más detalles**: defina la variable de entorno `LOG_LEVEL=debug` en el contenedor. Los registros normales solo guardan los inicios, los errores y las recuperaciones.

## Límites

- Solo lectura: ningún mensaje, ningún amigo, ninguna compra, nada cambia en Steam.
- El juego actual y el tiempo de juego necesitan un perfil público con detalles de juego públicos: si no, Steam los oculta, incluso a la clave del propietario de la cuenta.
- El propio estado de Steam puede llevar unos minutos de retraso, y una cuenta «invisible» parece desconectada.
- Un juego iniciado fuera de Steam no se ve; un juego que no es de Steam añadido a la biblioteca puede aparecer solo con su nombre.
- 20 cuentas como máximo; el widget muestra las diez primeras.
- Desarrollada sin una cuenta de Steam real a mano: sus comentarios son bienvenidos en el foro de Gladys.
