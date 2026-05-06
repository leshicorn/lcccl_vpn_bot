import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Bot, Keyboard, InputFile } from 'grammy';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// Local DB Logic (Simple JSON storage for VPS)
// -----------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const MAPPINGS_FILE = path.join(DATA_DIR, 'mappings.json');
const CONFIGS_DIR = path.join(DATA_DIR, 'configs');

// Ensure directories exist
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);
if (!existsSync(CONFIGS_DIR)) mkdirSync(CONFIGS_DIR);

interface Mapping {
  nickname: string;
  telegramId: number;
}

interface VpnConfig {
  id: string; // nickname_device
  nickname: string;
  device: string;
  fileName: string;
  content: string;
  updatedAt: number;
}

async function getMappings(): Promise<Mapping[]> {
  try {
    const data = await fs.readFile(MAPPINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return []; // Return empty array if file doesn't exist yet
  }
}

async function saveMappings(mappings: Mapping[]) {
  await fs.writeFile(MAPPINGS_FILE, JSON.stringify(mappings, null, 2), 'utf-8');
}

async function getConfig(id: string): Promise<VpnConfig | null> {
  const filePath = path.join(CONFIGS_DIR, `${id}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

async function saveConfig(config: VpnConfig) {
  const filePath = path.join(CONFIGS_DIR, `${config.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
}

async function getUserConfigs(nickname: string): Promise<VpnConfig[]> {
  try {
    const files = await fs.readdir(CONFIGS_DIR);
    const configs: VpnConfig[] = [];
    for (const file of files) {
      if (file.startsWith(`${nickname}_`) && file.endsWith('.json')) {
        const data = await fs.readFile(path.join(CONFIGS_DIR, file), 'utf-8');
        configs.push(JSON.parse(data));
      }
    }
    return configs;
  } catch (err) {
    return [];
  }
}

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
    const mappings = await getMappings();
    const userMapping = mappings.find(m => m.nickname === nickname);

    if (!userMapping) {
      await ctx.reply(`⚠️ Пользователь "${nickname}" не найден в списке разрешенных. Файл не сохранен.`);
      return;
    }

    try {
      // Get file content
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const response = await fetch(fileUrl);
      const content = await response.text();

      // Save to local storage
      const configId = `${nickname}_${device}`;
      await saveConfig({
        id: configId,
        nickname,
        device,
        content,
        fileName,
        updatedAt: Date.now(),
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
    const mappings = await getMappings();
    const userMapping = mappings.find(m => m.telegramId === tgId);
    
    if (!userMapping) {
      await ctx.reply("😔 Вы не найдены в списке разрешенных пользователей. Обратитесь к администратору.");
      return;
    }

    const nickname = userMapping.nickname;

    // Get all configs for this nickname
    const userConfigs = await getUserConfigs(nickname);

    if (userConfigs.length === 0) {
      await ctx.reply("📭 У вас пока нет доступных конфигураций.");
      return;
    }

    await ctx.reply(`Найдено конфигов: ${userConfigs.length}. Отправляю...`);

    for (const data of userConfigs) {
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
      const mappings = await getMappings();
      // add id field for frontend compatibility
      const mappingsWithId = mappings.map(m => ({ id: m.nickname, ...m }));
      res.json(mappingsWithId);
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
      const mappings = await getMappings();
      const targetNickname = nickname.toLowerCase();
      const existingIndex = mappings.findIndex(m => m.nickname === targetNickname);
      
      const newMapping = { nickname: targetNickname, telegramId: parseInt(telegramId) };
      
      if (existingIndex >= 0) {
        mappings[existingIndex] = newMapping;
      } else {
        mappings.push(newMapping);
      }
      
      await saveMappings(mappings);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save mapping" });
    }
  });

  // API: Delete Mapping
  app.delete("/api/mappings/:id", async (req, res) => {
    try {
      let mappings = await getMappings();
      mappings = mappings.filter(m => m.nickname !== req.params.id);
      await saveMappings(mappings);
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
