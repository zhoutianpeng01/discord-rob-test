// import { entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { Client, CommandInteraction, GuildMember, Snowflake, MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import { createListeningStream } from './createListeningStream';
import {
	//createAudioPlayer,
	//createAudioResource,
	entersState,
	//AudioPlayerStatus,
	VoiceConnection,
	VoiceConnectionStatus,
	joinVoiceChannel,
} from '@discordjs/voice';

async function join(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
	client: Client,
	connection?: VoiceConnection,
) {
	await interaction.deferReply();

	// createButton(interaction)

	if (!connection) {
		if (interaction.member instanceof GuildMember && interaction.member.voice.channel) {
			const channel = interaction.member.voice.channel;
			connection = joinVoiceChannel({
				channelId: channel.id,
				guildId: channel.guild.id,
				selfDeaf: false,
				selfMute: true,
				// @ts-expect-error Currently voice is built in mind with API v10 whereas discord.js v13 uses API v9.
				adapterCreator: channel.guild.voiceAdapterCreator,
			});
		} else {
			await interaction.followUp('Join a voice channel and then try that again!');
			return;
		}
	}

	try {
		console.log('start connection')
		await entersState(connection, VoiceConnectionStatus.Ready, 20e3);

		console.log('connection success')
		const receiver = connection.receiver;

		receiver.speaking.on('start', (userId) => {
			if (recordable.has(userId)) {
				createListeningStream(receiver, userId, client.users.cache.get(userId));
			}
		});
	} catch (error) {
		console.warn(error);
		await interaction.followUp('Failed to join voice channel within 20 seconds, please try again later!');
	}

	await interaction.followUp('Ready!');
}

async function record(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
	client: Client,
	connection?: VoiceConnection,
) {
	if (connection) {
		const userId = interaction.options.get('speaker')!.value! as Snowflake;
		
		console.log(userId)
		recordable.add(userId);

		const receiver = connection.receiver;
		console.log(connection.receiver)

		createListeningStream(receiver, userId, client.users.cache.get(userId));

		if (connection.receiver.speaking.users.has(userId)) {
			console.log('connection.receiver.speaking.users.has(userId)')
			createListeningStream(receiver, userId, client.users.cache.get(userId));
		}
		
		await interaction.reply({ ephemeral: true, content: 'Listening!' });
	} else {
		await interaction.reply({ ephemeral: true, content: 'Join a voice channel and then try that again!' });
	}

	createButton(interaction)
}

async function leave(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
	_client: Client,
	connection?: VoiceConnection,
) {
	if (connection) {
		connection.destroy();
		recordable.clear();
		await interaction.reply({ ephemeral: true, content: 'Left the channel!' });
	} else {
		await interaction.reply({ ephemeral: true, content: 'Not playing in this server!' });
	}
}


 async function createButton(interaction: CommandInteraction) {

	const channel = interaction.channel;

	if (!channel) {
		await interaction.reply('Sorry, I could find the channel associated with this interaction.');
		return;
	}

	// 创建一个embed，用于显示loading信息
	const loadingEmbed = new MessageEmbed()
	.setColor('#0099ff')
	.setTitle('Loading...')
	.setDescription('Please wait while we process your request.');

	// 创建一个按钮，用户可以点击它来取消操作
	const cancelButton = new MessageButton()
		.setCustomId('cancel')
		.setLabel('Cancel')
		.setStyle('DANGER');

	// 把按钮添加到一个行中，以便和消息一起发送
	const row = new MessageActionRow().addComponents(cancelButton);

	// 发送embed和按钮
	const loadingMessage = await channel.send({ embeds: [loadingEmbed], components: [row] });

	// 设置一个收听器，等待按钮点击事件
	const filter = (i: any) => i.customId === 'cancel' && i.user.id === interaction.user.id;
	const collector = channel.createMessageComponentCollector({ filter, time: 15000 });

	collector.on('collect', async i => {
		if (i.customId === 'cancel') {
			await i.update({ content: 'The operation has been cancelled.', components: [] });
		}
	});

	collector.on('end', collected => {
		if (collected.size === 0) loadingMessage.edit({ content: 'The operation timed out.', components: [] });
	});
}

export const interactionHandlers = new Map<
	string,
	(
		interaction: CommandInteraction,
		recordable: Set<Snowflake>,
		client: Client,
		connection?: VoiceConnection,
	) => Promise<void>
>();
interactionHandlers.set('join', join);
interactionHandlers.set('record', record);
interactionHandlers.set('leave', leave);
