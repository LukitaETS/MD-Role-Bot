# Bot de Discord para DMs por rol

Bot completo de Discord usando Node.js, Discord.js v14 y dotenv. Esta preparado para alojarse en Render.com como **Background Worker**.

El comando principal es:

```txt
/dmrol rol mensaje
```

Solo administradores pueden usarlo. El bot obtiene todos los miembros con el rol seleccionado, envia el mensaje por DM, ignora usuarios con DMs cerrados y muestra cuantos mensajes fueron enviados y cuantos fallaron.

## Requisitos

- Node.js 20 o superior
- Una aplicacion creada en Discord Developer Portal
- Un servidor de Discord donde tengas permisos de administrador
- Una cuenta de GitHub
- Una cuenta de Render

## Archivos incluidos

```txt
.
|-- commands/
|   `-- dmrol.js
|-- .gitignore
|-- .env.example
|-- deploy-commands.js
|-- index.js
|-- package.json
`-- README.md
```

## Crear la aplicacion en Discord

1. Entra a [Discord Developer Portal](https://discord.com/developers/applications).
2. Pulsa **New Application**.
3. Escribe el nombre del bot y confirma.
4. En el menu izquierdo entra en **Bot**.
5. Pulsa **Add Bot** si todavia no existe.

## Obtener el token

1. En Discord Developer Portal entra en tu aplicacion.
2. Ve a **Bot**.
3. Pulsa **Reset Token** o **View Token**.
4. Copia el token.
5. Nunca pegues el token directamente en el codigo.

En local, crea un archivo `.env` basado en `.env.example`:

```env
DISCORD_TOKEN=tu_token_real
CLIENT_ID=id_de_tu_aplicacion
GUILD_ID=id_de_tu_servidor
AUTO_DEPLOY_COMMANDS=true
```

`GUILD_ID` es opcional, pero recomendado para pruebas porque registra los slash commands casi al instante en un servidor especifico.

## Obtener CLIENT_ID y GUILD_ID

Para obtener `CLIENT_ID`:

1. Entra en tu aplicacion del Developer Portal.
2. Ve a **General Information**.
3. Copia **Application ID**.

Para obtener `GUILD_ID`:

1. En Discord activa **Developer Mode** desde ajustes de usuario.
2. Haz clic derecho sobre tu servidor.
3. Pulsa **Copy Server ID**.

## Activar SERVER MEMBERS INTENT

Este bot necesita leer los miembros del servidor para saber quienes tienen el rol elegido.

1. Entra en [Discord Developer Portal](https://discord.com/developers/applications).
2. Abre tu aplicacion.
3. Ve a **Bot**.
4. Busca **Privileged Gateway Intents**.
5. Activa **SERVER MEMBERS INTENT**.
6. Guarda los cambios si Discord lo solicita.

El codigo usa estos intents:

- `Guilds`
- `GuildMembers`
- `GuildMessages`

## Invitar el bot al servidor

1. En Discord Developer Portal entra en tu aplicacion.
2. Ve a **OAuth2** y luego **URL Generator**.
3. En **Scopes** marca:
   - `bot`
   - `applications.commands`
4. En **Bot Permissions** marca:
   - `Administrator`
5. Copia la URL generada.
6. Abrela en el navegador e invita el bot a tu servidor.

> Nota: el comando `/dmrol` tambien esta limitado a administradores desde el codigo.

## Instalar dependencias en local

```bash
npm install
```

## Registrar slash commands

El bot registra los slash commands automaticamente cada vez que inicia con `npm start`.

Esto evita tener que usar el Shell de Render.

Si quieres registrarlos manualmente desde tu PC, tambien puedes ejecutar:

```bash
npm run deploy:commands
```

Si configuraste `GUILD_ID`, el comando se registra solo en ese servidor y suele aparecer casi al instante.

Si no configuraste `GUILD_ID`, el comando se registra globalmente y puede tardar hasta 1 hora en aparecer.

## Iniciar el bot en local

```bash
npm start
```

Si todo esta bien, veras logs en consola indicando que el bot se conecto correctamente.

## Subir el proyecto a GitHub

1. Crea un repositorio nuevo en GitHub.
2. Desde la carpeta del proyecto ejecuta:

```bash
git init
git add .
git commit -m "Crear bot Discord DM por rol"
git branch -M main
git remote add origin https://github.com/tu_usuario/tu_repositorio.git
git push -u origin main
```

No subas tu archivo `.env`. Solo sube `.env.example`.

## Deploy en Render como Background Worker

1. Entra a [Render Dashboard](https://dashboard.render.com/).
2. Pulsa **New**.
3. Selecciona **Background Worker**.
4. Conecta tu repositorio de GitHub.
5. Configura:

```txt
Runtime: Node
Build Command: npm install
Start Command: npm start
```

6. En **Environment Variables**, agrega:

```txt
DISCORD_TOKEN=tu_token_real
CLIENT_ID=id_de_tu_aplicacion
GUILD_ID=id_de_tu_servidor
AUTO_DEPLOY_COMMANDS=true
NODE_VERSION=20.11.0
```

7. Crea el servicio.
8. Revisa los logs de Render para confirmar que el bot inicio correctamente.

## Registrar slash commands en Render

No necesitas abrir el Shell de Render ni cambiar el Start Command.

Con `AUTO_DEPLOY_COMMANDS=true`, el bot hace esto solo al iniciar:

1. Render ejecuta `npm install` durante el build.
2. Render ejecuta `npm start` para encender el Worker.
3. `index.js` registra automaticamente `/dmrol`.
4. El bot queda encendido normalmente.

Si no quieres registrar comandos en cada inicio, cambia:

```txt
AUTO_DEPLOY_COMMANDS=false
```

## Reiniciar el bot en Render

1. Entra a tu servicio en Render.
2. Pulsa **Manual Deploy**.
3. Selecciona **Deploy latest commit**.

Tambien puedes reiniciarlo guardando cambios en variables de entorno o haciendo un nuevo push a GitHub.

## Uso del comando

En tu servidor escribe:

```txt
/dmrol
```

Completa:

- `rol`: el rol cuyos miembros recibiran el DM
- `mensaje`: el texto que se enviara por privado

El bot respondera solo al administrador con un resumen:

- mensajes enviados
- mensajes fallidos
- total procesado

## Notas de produccion

- Los DMs pueden fallar si el usuario tiene mensajes privados cerrados.
- No abuses del envio masivo de DMs. Respeta las reglas de Discord y evita spam.
- El bot incluye una pausa entre mensajes para reducir problemas con limites de velocidad.
- El token debe estar siempre en variables de entorno, nunca en el codigo.

## Documentacion oficial util

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord Gateway Intents](https://docs.discord.com/developers/events/gateway#gateway-intents)
- [Render Background Workers](https://render.com/docs/background-workers)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Render Deploys](https://render.com/docs/deploys)
