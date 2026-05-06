import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Bot, Keyboard, InputFile } from 'grammy';
import * as admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8'));

// Initialize Firebase Admin
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = admin.firestore(firebaseConfig.firestoreDatabaseId);

// -----------------------------------------------------------------------------
// Telegram Bot Logic
// -----------------------------------------------------------------------------

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = process.env.ADMIN_TG_ID ? parseInt(process.env.ADMIN_TG_ID) : null;

if (!token) {
  console.warn("TELEGRAM_BOT_TOKEN is missing. Bot will not start.");
}

const bot = token ? new Bot(token) : null;

if (bot) {
  // Main menu keyboard
  const mainKeyboard = new Keyboard()
    .text("📦 Мои конфиги")
    .resized();

  bot.command("start", async (ctx) => {
    await ctx.reply("Привет! Я бот для раздачи VPN-конфигов Amnezia. Нажми кнопку ниже, чтобы получить свои файлы.", {
      reply_markup: mainKeyboard,
    });
  });

  // Admin: Handling document uploads
  bot.on("message:document", async (ctx) => {
    if (ctx.from.id !== adminId) {
      return; // Ignore non-admin documents
    }

    const doc = ctx.message.document;
    const fileName = doc.file_name || "unknown.conf";
    
    // Parse filename: <user>_<device>.conf
    const match = fileName.match(/^([a-z0-9]+)_([a-z0-9]+)\.conf$/i);
    if (!match) {
      await ctx.reply(`❌ Не удалось определить владельца файла: ${fileName}\nОжидаемый формат: user_device.conf`);
      return;
    }

    const [_, userPart, devicePart] = match;
    const nickname = userPart.toLowerCase();
    const device = devicePart.toLowerCase();

    // Check if user exists in mappings
    const mappingRef = db.collection('mappings').doc(nickname);
    const mappingSnap = await mappingRef.get();

    if (!mappingSnap.exists) {
      await ctx.reply(`⚠️ Пользователь "${nickname}" не найден в списке разрешенных. Файл не сохранен.`);
      return;
    }

    try {
      // Get file content
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const response = await fetch(fileUrl);
      const content = await response.text();

      // Save to Firestore
      const configId = `${nickname}_${device}`;
      await db.collection('configs').doc(configId).set({
        nickname,
        device,
        content,
        fileName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await ctx.reply(`✅ Конфиг сохранен для ${nickname} (${device})`);
    } catch (error) {
      console.error("Error saving config:", error);
      await ctx.reply("❌ Ошибка при сохранении конфига.");
    }
  });

  // User: "My Configs" button
  bot.hears("📦 Мои конфиги", async (ctx) => {
    const tgId = ctx.from.id;

    // Find nickname by TG ID
    const mappingQuery = await db.collection('mappings').where('telegramId', '==', tgId).get();
    
    if (mappingQuery.empty) {
      await ctx.reply("😔 Вы не найдены в списке разрешенных пользователей. Обратитесь к администратору.");
      return;
    }

    const nickname = mappingQuery.docs[0].id;

    // Get all configs for this nickname
    const configsQuery = await db.collection('configs').where('nickname', '==', nickname).get();

    if (configsQuery.empty) {
      await ctx.reply("📭 У вас пока нет доступных конфигураций.");
      return;
    }

    await ctx.reply(`Найдено конфигов: ${configsQuery.size}. Отправляю...`);

    for (const configDoc of configsQuery.docs) {
      const data = configDoc.data();
      const buffer = Buffer.from(data.content, 'utf-8');
      await ctx.replyWithDocument(new InputFile(buffer, data.fileName));
    }
  });

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  bot.start();
  console.log("Telegram Bot started.");
}

// -----------------------------------------------------------------------------
// Express Server Logic
// -----------------------------------------------------------------------------

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Get Mappings
  app.get("/api/mappings", async (req, res) => {
    try {
      const snapshot = await db.collection('mappings').get();
      const mappings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch mappings" });
    }
  });

  // API: Add/Update Mapping
  app.post("/api/mappings", async (req, res) => {
    const { nickname, telegramId } = req.body;
    if (!nickname || !telegramId) {
      return res.status(400).json({ error: "Nickname and Telegram ID required" });
    }
    try {
      await db.collection('mappings').doc(nickname.toLowerCase()).set({
        nickname: nickname.toLowerCase(),
        telegramId: parseInt(telegramId),
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save mapping" });
    }
  });

  // API: Delete Mapping
  app.delete("/api/mappings/:id", async (req, res) => {
    try {
      await db.collection('mappings').doc(req.params.id).delete();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete mapping" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
