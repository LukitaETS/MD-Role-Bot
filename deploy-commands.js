require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

function cargarComandos() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));

    if ('data' in command) {
      commands.push(command.data.toJSON());
      console.log(`Correcto: comando preparado para registrar: /${command.data.name}`);
    } else {
      console.warn(`Aviso: el archivo ${file} no tiene "data".`);
    }
  }

  return commands;
}

async function registrarComandosSlash(options = {}) {
  const token = options.token ?? process.env.DISCORD_TOKEN;
  const clientId = options.clientId ?? process.env.CLIENT_ID;
  const guildId = options.guildId ?? process.env.GUILD_ID;

  if (!token || !clientId) {
    throw new Error('Faltan DISCORD_TOKEN o CLIENT_ID para registrar los slash commands.');
  }

  const commands = cargarComandos();
  const rest = new REST({ version: '10' }).setToken(token);

  console.log('Registrando slash commands...');

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands
    });
    console.log(`Correcto: slash commands registrados en el servidor ${guildId}.`);
    console.log('Ayuda: los comandos de servidor suelen aparecer casi al instante.');
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), {
    body: commands
  });
  console.log('Correcto: slash commands globales registrados correctamente.');
  console.log('Ayuda: los comandos globales pueden tardar hasta 1 hora en aparecer.');
}

if (require.main === module) {
  registrarComandosSlash().catch((error) => {
    console.error('Error registrando slash commands:', error);
    process.exit(1);
  });
}

module.exports = {
  registrarComandosSlash
};
