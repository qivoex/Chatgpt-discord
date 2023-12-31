require('dotenv/config');
const { Client, IntentsBitField } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');
const fs = require('fs'); // استيراد مكتبة للتعامل مع ملفات JSON
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});
//-----------------------------------------------------------------------------
client.on('ready', () => {
  console.log('The bot is online!');
});
//-----------------------------------------------------------------------------
const configuration = new Configuration({
  apiKey: process.env.API_KEY,
});

const openai = new OpenAIApi(configuration);
//-----------------------------------------------------------------------------
// قراءة ملف الإعدادات JSON
let settings = {};
try {
  const settingsData = fs.readFileSync('settings.json', 'utf8');
  settings = JSON.parse(settingsData);
} catch (error) {
  console.error('خطأ في قراءة ملف الإعدادات JSON:', error);
}
//-----------------------------------------------------------------------------
// قائمة بمعرفات القنوات المرتبطة
const channelIds = settings.CHANNEL_IDS || [];
//-----------------------------------------------------------------------------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
//-----------------------------------------------------------------------------
// التحقق من هوية صاحب الخادم (الأونر)
const isServerOwner = message.guild && message.guild.ownerId === message.author.id;
// أمر لتعيين قيمة CHANNEL_ID
if (message.content.startsWith('setchannel')) {
  const channelId = message.content.split(' ')[1];
  if (channelId) {
    if (isServerOwner) {
      if (channelIds.includes(channelId)) {
        message.reply(`**البوت مربوط بالفعل بهذا الشات <#${channelId}>.**`);
      } else {
        channelIds.push(channelId);
        settings.CHANNEL_IDS = channelIds;
        fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2), 'utf8');
        message.reply(`**تم تعيين <#${channelId}> شات Chatgpt**`);
      }
    } else {
      message.reply(`**عذرًا، هذا الأمر متاح فقط لصاحب الخادم (الأونر).**`);
    }
    return;
  }
}
//-----------------------------------------------------------------------------
  // أمر لإزالة قيمة CHANNEL_ID
  if (message.content.startsWith('removechannel')) {
    if (settings.CHANNEL_IDS) {
      const removedChannelId = message.channel.id;
      if (channelIds.includes(removedChannelId)) {
        if (isServerOwner) {
          channelIds.splice(channelIds.indexOf(removedChannelId), 1);
          settings.CHANNEL_IDS = channelIds;
          fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2), 'utf8');
          message.reply(`**تمت إزالة الشات بنجاح من <#${removedChannelId}>**`);
        } else {
          message.reply(`**عذرًا، هذا الأمر متاح فقط لصاحب الخادم (الأونر).**`);
        }
      } else {
        message.reply(`**البوت غير مربوط بهذا الشات <#${removedChannelId}>**`);
      }
    } else {
      message.reply(`**ليس هناك شات مربوط. يرجى ربط البوت بالشات أولاً.**`);
    }
    return;
  }

  // التحقق مما إذا كانت الرسالة مرسلة في إحدى القنوات المعرفة
  if (!channelIds.includes(message.channel.id)) {
    message.reply('**عذرًا، هذه القناة غير معرفة للبوت.**');
    return;
  }
//-----------------------------------------------------------------------------
  if (message.content.startsWith('!')) return;

  let conversationLog = [
    { role: 'system', content: 'You are a friendly chatbot.' },
  ];

  try {
    await message.channel.sendTyping();
    let prevMessages = await message.channel.messages.fetch({ limit: 15 });
    prevMessages.reverse();

    prevMessages.forEach((msg) => {
      if (msg.content.startsWith('!')) return;
      if (msg.author.id !== client.user.id && message.author.bot) return;
      if (msg.author.id == client.user.id) {
        conversationLog.push({
          role: 'assistant',
          content: msg.content,
          name: msg.author.username
            .replace(/\s+/g, '_')
            .replace(/[^\w\s]/gi, ''),
        });
      }

      if (msg.author.id == message.author.id) {
        conversationLog.push({
          role: 'user',
          content: msg.content,
          name: message.author.username
            .replace(/\s+/g, '_')
            .replace(/[^\w\s]/gi, ''),
        });
      }
    });

    const result = await openai
      .createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: conversationLog,
        // max_tokens: 256, // limit token usage
      })
      .catch((error) => {
        console.log(`OPENAI ERR: ${error}`);
      });
    message.reply(result.data.choices[0].message);
  } catch (error) {
    console.log(`ERR: ${error}`);
  }
});
//-----------------------------------------------------------------------------
client.login(process.env.TOKEN);
//-----------------------------------------------------------------------------