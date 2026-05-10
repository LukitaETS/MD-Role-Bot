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

const token = process.env.DISCORD_TOKEN;
const autoDeployCommands = process.env.AUTO_DEPLOY_COMMANDS !== 'false';
const enableHealthServer = process.env.ENABLE_HEALTH_SERVER !== 'false';
const port = Number(process.env.PORT) || 10000;

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
      tokenConfigurado: Boolean(token)
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
  console.log('========================================');
  console.log(`Correcto: bot conectado como ${readyClient.user.tag}`);
  console.log(`Identificador del bot: ${readyClient.user.id}`);
  console.log(`Servidores conectados: ${readyClient.guilds.cache.size}`);
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

  readyClient.user.setActivity('/dmrol para enviar DMs por rol', {
    type: ActivityType.Listening
  });
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

process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada sin manejar:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Excepcion no capturada:', error);
});

iniciarServidorSalud();

if (!token) {
  console.error('Error: no se encontro DISCORD_TOKEN en las variables de entorno.');
  console.error('Ayuda: configura DISCORD_TOKEN en Render y vuelve a desplegar.');
} else {
  client.login(token).catch((error) => {
    console.error('Error: no se pudo iniciar sesion en Discord:', error);
  });
}
