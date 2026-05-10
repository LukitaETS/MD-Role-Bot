require('dotenv').config();

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  ActivityType
} = require('discord.js');
const { registrarComandosSlash } = require('./deploy-commands');

const rawToken = process.env.DISCORD_TOKEN?.trim().replace(/^["']|["']$/g, '');
const tokenTeniaPrefijoBot = /^Bot\s+/i.test(rawToken ?? '');
const token = rawToken?.replace(/^Bot\s+/i, '');
const autoDeployCommands = process.env.AUTO_DEPLOY_COMMANDS !== 'false';
const enableHealthServer = process.env.ENABLE_HEALTH_SERVER !== 'false';
const enableDiscordDebug = process.env.DEBUG_DISCORD === 'true';
const port = Number(process.env.PORT) || 10000;
const loginTimeoutMs = Number(process.env.LOGIN_TIMEOUT_MS) || 90000;
const estadoDiscord = {
  estado: 'iniciando',
  detalle: 'El proceso de Node inicio correctamente.',
  ultimoError: null,
  loginIntentado: false,
  loginIniciadoEn: null
};
const pruebaToken = {
  estado: 'pendiente',
  detalle: 'Todavia no se probo el token contra la API REST de Discord.',
  codigoHttp: null,
  botId: null,
  usuario: null,
  clientIdCoincide: null
};

// Intents requeridos por el proyecto: servidores, miembros y mensajes de servidor.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ],
  allowedMentions: {
    parse: []
  }
});

function iniciarServidorSalud() {
  if (!enableHealthServer) {
    console.log('Servidor de salud desactivado por ENABLE_HEALTH_SERVER=false.');
    return;
  }

  const server = http.createServer((request, response) => {
    const respuesta = {
      estado: 'ok',
      servicio: 'bot-discord-dmrol',
      botConectado: client.isReady(),
      usuario: client.user?.tag ?? null,
      botId: client.user?.id ?? null,
      clientIdConfigurado: process.env.CLIENT_ID ?? null,
      servidoresConectados: client.guilds.cache.size,
      servidores: client.guilds.cache.map((guild) => ({
        id: guild.id,
        nombre: guild.name
      })),
      tokenConfigurado: Boolean(token),
      tokenConEspacios: process.env.DISCORD_TOKEN !== process.env.DISCORD_TOKEN?.trim(),
      tokenConPrefijoBot: tokenTeniaPrefijoBot,
      tokenFormato: token ? (token.split('.').length === 3 ? 'parece_valido' : 'formato_raro') : 'sin_token',
      discord: estadoDiscord,
      pruebaToken,
      uptimeSegundos: Math.round(process.uptime())
    };

    if (request.url === '/' || request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(respuesta));
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  });

  server.on('error', (error) => {
    console.error('Error: no se pudo iniciar el servidor de salud:', error);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Servidor de salud activo en el puerto ${port}.`);
    console.log('Render ya puede detectar un puerto abierto para Web Service.');
  });
}

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`Correcto: comando cargado: /${command.data.name}`);
  } else {
    console.warn(`Aviso: el archivo ${file} no tiene "data" o "execute".`);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  estadoDiscord.estado = 'conectado';
  estadoDiscord.detalle = `Bot conectado como ${readyClient.user.tag}.`;
  estadoDiscord.ultimoError = null;

  console.log('========================================');
  console.log(`Correcto: bot conectado como ${readyClient.user.tag}`);
  console.log(`Identificador del bot: ${readyClient.user.id}`);
  console.log(`Servidores conectados: ${readyClient.guilds.cache.size}`);
  readyClient.guilds.cache.forEach((guild) => {
    console.log(`Servidor detectado: ${guild.name} (${guild.id})`);
  });
  console.log('Bot listo para trabajar en Render como Background Worker.');
  console.log('========================================');

  if (autoDeployCommands) {
    try {
      console.log('Registro automatico activado: preparando slash commands...');
      await registrarComandosSlash({
        token,
        clientId: process.env.CLIENT_ID ?? readyClient.application?.id ?? readyClient.user.id
      });
    } catch (error) {
      console.error('Error: no se pudieron registrar automaticamente los slash commands:', error);
      console.error('Ayuda: revisa DISCORD_TOKEN, CLIENT_ID y GUILD_ID en las variables de entorno.');
    }
  } else {
    console.log('Registro automatico desactivado por AUTO_DEPLOY_COMMANDS=false.');
  }

  readyClient.user.setPresence({
    status: 'online',
    activities: [
      {
        name: '/dmrol para enviar DMs por rol',
        type: ActivityType.Listening
      }
    ]
  });
  console.log('Presencia de Discord configurada como online.');
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.warn(`Aviso: se recibio un comando no registrado: /${interaction.commandName}`);
    return;
  }

  try {
    console.log(
      `Comando /${interaction.commandName} usado por ${interaction.user.tag} en ${interaction.guild?.name ?? 'DM'}`
    );
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error ejecutando /${interaction.commandName}:`, error);

    const errorMessage = {
      content: 'Ocurrio un error al ejecutar el comando. Revisa los logs del bot.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(() => null);
    } else {
      await interaction.reply(errorMessage).catch(() => null);
    }
  }
});

client.on(Events.GuildCreate, (guild) => {
  console.log(`Bot agregado al servidor: ${guild.name} (${guild.id})`);
});

client.on(Events.GuildDelete, (guild) => {
  console.log(`Bot removido del servidor: ${guild.name} (${guild.id})`);
});

client.on(Events.Error, (error) => {
  estadoDiscord.estado = 'error';
  estadoDiscord.detalle = 'Discord envio un error al cliente.';
  estadoDiscord.ultimoError = error.message;
  console.error('Error recibido desde Discord:', error);
});

client.on(Events.Warn, (message) => {
  console.warn(`Aviso de Discord.js: ${message}`);
});

if (enableDiscordDebug) {
  client.on(Events.Debug, (message) => {
    console.log(`Debug de Discord.js: ${message}`);
  });
}

client.on(Events.ShardError, (error, shardId) => {
  estadoDiscord.estado = 'error';
  estadoDiscord.detalle = `Error en el shard ${shardId}.`;
  estadoDiscord.ultimoError = error.message;
  console.error(`Error en shard ${shardId}:`, error);
});

client.on(Events.ShardDisconnect, (event, shardId) => {
  estadoDiscord.estado = 'desconectado';
  estadoDiscord.detalle = `Shard ${shardId} desconectado con codigo ${event.code}.`;
  estadoDiscord.ultimoError = event.reason || null;

  console.error(`Shard ${shardId} desconectado. Codigo: ${event.code}. Razon: ${event.reason || 'sin razon'}`);

  if (event.code === 4014) {
    console.error('Causa probable: tienes un intent privilegiado apagado en Discord Developer Portal.');
    console.error('Solucion: activa SERVER MEMBERS INTENT en la seccion Bot de tu aplicacion.');
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada sin manejar:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Excepcion no capturada:', error);
});

async function probarTokenDiscord() {
  pruebaToken.estado = 'probando';
  pruebaToken.detalle = 'Consultando https://discord.com/api/v10/users/@me desde Render.';
  pruebaToken.codigoHttp = null;
  pruebaToken.botId = null;
  pruebaToken.usuario = null;
  pruebaToken.clientIdCoincide = null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${token}`
      },
      signal: controller.signal
    });

    pruebaToken.codigoHttp = response.status;

    if (!response.ok) {
      pruebaToken.estado = 'rechazado';
      pruebaToken.detalle =
        response.status === 401
          ? 'Discord rechazo el token. Regenera DISCORD_TOKEN en Developer Portal.'
          : `Discord respondio con HTTP ${response.status}.`;
      console.error(`Error: la prueba REST del token fallo con HTTP ${response.status}.`);
      return;
    }

    const data = await response.json();
    pruebaToken.estado = 'valido';
    pruebaToken.detalle = 'Discord acepto el token por API REST.';
    pruebaToken.botId = data.id;
    pruebaToken.usuario = `${data.username}#${data.discriminator}`;
    pruebaToken.clientIdCoincide = process.env.CLIENT_ID ? data.id === process.env.CLIENT_ID : null;

    console.log(`Correcto: Discord acepto el token REST para ${pruebaToken.usuario} (${data.id}).`);

    if (process.env.CLIENT_ID && data.id !== process.env.CLIENT_ID) {
      console.error(`Error: CLIENT_ID (${process.env.CLIENT_ID}) no coincide con el bot del token (${data.id}).`);
      console.error('Solucion: usa el CLIENT_ID de la misma aplicacion de donde sacaste el token.');
    }
  } catch (error) {
    pruebaToken.estado = 'sin_respuesta';
    pruebaToken.detalle = 'No hubo respuesta de la API REST de Discord desde Render.';
    pruebaToken.codigoHttp = null;
    console.error('Error: no se pudo probar el token contra la API REST de Discord:', error);
  } finally {
    clearTimeout(timeout);
  }
}

iniciarServidorSalud();

if (!token) {
  estadoDiscord.estado = 'sin_token';
  estadoDiscord.detalle = 'Falta DISCORD_TOKEN en Render.';
  estadoDiscord.ultimoError = 'DISCORD_TOKEN no configurado.';
  console.error('Error: no se encontro DISCORD_TOKEN en las variables de entorno.');
  console.error('Ayuda: configura DISCORD_TOKEN en Render y vuelve a desplegar.');
} else {
  probarTokenDiscord();

  estadoDiscord.estado = 'login_iniciado';
  estadoDiscord.detalle = 'Se llamo a client.login(). Esperando respuesta de Discord.';
  estadoDiscord.ultimoError = null;
  estadoDiscord.loginIntentado = true;
  estadoDiscord.loginIniciadoEn = new Date().toISOString();

  console.log('Intentando iniciar sesion en Discord...');

  const loginTimeout = setTimeout(() => {
    if (!client.isReady()) {
      estadoDiscord.estado = 'login_sin_respuesta';
      estadoDiscord.detalle = `Discord no confirmo la conexion despues de ${Math.round(loginTimeoutMs / 1000)} segundos.`;
      estadoDiscord.ultimoError = 'Revisa el token, los intents privilegiados y los logs de Render.';
      console.error(`Error: Discord no confirmo la conexion despues de ${Math.round(loginTimeoutMs / 1000)} segundos.`);
      console.error('Ayuda: revisa DISCORD_TOKEN, SERVER MEMBERS INTENT y si Render muestra errores de red.');
    }
  }, loginTimeoutMs);

  client.login(token).then(() => {
    clearTimeout(loginTimeout);
    estadoDiscord.estado = 'conectando';
    estadoDiscord.detalle = 'Token aceptado. Esperando evento ClientReady de Discord.';
    estadoDiscord.ultimoError = null;
    console.log('Token aceptado por Discord. Esperando confirmacion de conexion...');
  }).catch((error) => {
    clearTimeout(loginTimeout);
    estadoDiscord.estado = 'error_login';
    estadoDiscord.detalle = 'Discord rechazo el inicio de sesion.';
    estadoDiscord.ultimoError = error.message;
    console.error('Error: no se pudo iniciar sesion en Discord:', error);
    console.error('Causa probable: DISCORD_TOKEN invalido, vencido, regenerado o mal copiado.');
  });
}
