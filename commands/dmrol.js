const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');

const PAUSA_ENTRE_DMS_MS = 1200;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dmrol')
    .setDescription('Envia un mensaje privado a todos los usuarios con un rol especifico.')
    .addRoleOption((option) =>
      option
        .setName('rol')
        .setDescription('Rol cuyos miembros recibiran el mensaje privado.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('mensaje')
        .setDescription('Mensaje que se enviara por DM.')
        .setRequired(true)
        .setMaxLength(1800)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    const rol = interaction.options.getRole('rol', true);
    const mensaje = interaction.options.getString('mensaje', true);

    if (!interaction.guild) {
      await interaction.reply({
        content: 'Este comando solo puede usarse dentro de un servidor.',
        ephemeral: true
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'Solo administradores pueden usar este comando.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    console.log('========================================');
    console.log(`Iniciando envio de DMs por rol en: ${interaction.guild.name}`);
    console.log(`Rol seleccionado: ${rol.name} (${rol.id})`);
    console.log(`Administrador: ${interaction.user.tag} (${interaction.user.id})`);

    let miembros;

    try {
      console.log('Obteniendo miembros del servidor desde Discord...');
      await interaction.guild.members.fetch();
      miembros = rol.members.filter((member) => !member.user.bot);
    } catch (error) {
      console.error('Error: no se pudieron obtener los miembros del servidor:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff3b30)
        .setTitle('No se pudieron obtener los miembros')
        .setDescription(
          'Revisa que el bot tenga activado SERVER MEMBERS INTENT en Discord Developer Portal y que tenga permisos dentro del servidor.'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (miembros.size === 0) {
      console.log('Aviso: no hay usuarios humanos con ese rol.');

      const emptyEmbed = new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle('No hay destinatarios')
        .setDescription(`No encontre usuarios humanos con el rol ${rol}.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [emptyEmbed] });
      return;
    }

    const inicioEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Envio de DMs iniciado')
      .setDescription(`Voy a enviar el mensaje a **${miembros.size}** usuario(s) con el rol ${rol}.`)
      .addFields(
        { name: 'Rol', value: `${rol}`, inline: true },
        { name: 'Destinatarios', value: `${miembros.size}`, inline: true }
      )
      .setFooter({ text: 'El proceso puede tardar segun la cantidad de miembros.' })
      .setTimestamp();

    await interaction.editReply({ embeds: [inicioEmbed] });

    let enviados = 0;
    let fallidos = 0;

    const dmEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Mensaje de ${interaction.guild.name}`)
      .setDescription(mensaje)
      .setFooter({ text: `Enviado por ${interaction.user.tag}` })
      .setTimestamp();

    for (const member of miembros.values()) {
      try {
        await member.send({ embeds: [dmEmbed] });
        enviados += 1;
        console.log(`Correcto: DM enviado a ${member.user.tag} (${member.user.id})`);
      } catch (error) {
        fallidos += 1;
        console.warn(
          `Aviso: no se pudo enviar DM a ${member.user.tag} (${member.user.id}). Puede tener DMs cerrados.`
        );
      }

      await esperar(PAUSA_ENTRE_DMS_MS);
    }

    const resultadoEmbed = new EmbedBuilder()
      .setColor(fallidos === 0 ? 0x2ecc71 : 0xffcc00)
      .setTitle('Envio de DMs finalizado')
      .setDescription(`Termine de enviar mensajes al rol ${rol}.`)
      .addFields(
        { name: 'Enviados', value: `${enviados}`, inline: true },
        { name: 'Fallidos', value: `${fallidos}`, inline: true },
        { name: 'Total procesados', value: `${miembros.size}`, inline: true }
      )
      .setFooter({ text: 'Los fallidos normalmente tienen DMs cerrados o bloquean bots.' })
      .setTimestamp();

    console.log('Correcto: envio finalizado.');
    console.log(`Enviados: ${enviados}`);
    console.log(`Fallidos: ${fallidos}`);
    console.log('========================================');

    await interaction.editReply({ embeds: [resultadoEmbed] });
  }
};
