import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, User, Smartphone, Send, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Mapping {
  id: string;
  nickname: string;
  telegramId: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'users' | 'configs'>('users');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [newNickname, setNewNickname] = useState('');
  const [newTgId, setNewTgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const fetchMappings = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/mappings');
      const data = await res.json();
      setMappings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setMappings([]);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchConfigs = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/configs');
      const data = await res.json();
      setConfigs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setConfigs([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchConfigs();
  }, []);

  const addMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNickname || !newTgId) return;
    setLoading(true);
    try {
      await fetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: newNickname, telegramId: newTgId }),
      });
      setNewNickname('');
      setNewTgId('');
      fetchMappings();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteMapping = async (id: string) => {
    if (!confirm(`Удалить участника ${id}?`)) return;
    try {
      await fetch(`/api/mappings/${id}`, { method: 'DELETE' });
      fetchMappings();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteConfig = async (id: string) => {
    if (!confirm(`Удалить конфигурацию ${id}?`)) return;
    try {
      await fetch(`/api/configs/${id}`, { method: 'DELETE' });
      fetchConfigs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const content = await file.text();
      const res = await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, content }),
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Ошибка загрузки');
      
      fetchConfigs();
      alert('Конфиг успешно загружен');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium tracking-wider uppercase">
              <Shield className="w-4 h-4 text-blue-500" />
              VPN Family Hub
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Админ-панель</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { fetchMappings(); fetchConfigs(); }}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <a 
              href="https://t.me/BotFather" 
              target="_blank" 
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-lg shadow-blue-900/20"
            >
              <Send className="w-4 h-4" />
              Перейти к боту
            </a>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Участники
          </button>
          <button
            onClick={() => setActiveTab('configs')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'configs' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Конфигурации
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {activeTab === 'users' ? (
            <>
              {/* Form Side */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-xl">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-500" />
                    Добавить участника
                  </h2>
                  <form onSubmit={addMapping} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500 uppercase ml-1">Никнейм</label>
                      <input
                        type="text"
                        placeholder="E.g. natalya"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white"
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500 uppercase ml-1">Telegram ID</label>
                      <input
                        type="number"
                        placeholder="123456789"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={newTgId}
                        onChange={(e) => setNewTgId(e.target.value)}
                      />
                    </div>
                    <button
                      disabled={loading}
                      className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-all mt-2 cursor-pointer"
                    >
                      {loading ? 'Добавление...' : 'Сохранить'}
                    </button>
                  </form>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-2xl p-6 text-sm text-zinc-400 leading-relaxed italic">
                  "Бот автоматически распределяет файлы .conf по никнеймам. Название файла должно быть в формате nickname_device.conf"
                </div>
              </div>

              {/* List Side */}
              <div className="lg:col-span-8 overflow-hidden">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-xl">
                  <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
                    <h2 className="font-semibold">Список соответствий</h2>
                    <span className="text-xs font-mono px-2 py-1 bg-zinc-800 rounded-md text-zinc-500">
                      {mappings.length} USERS
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-800/50 max-h-[600px] overflow-auto">
                    <AnimatePresence mode='popLayout'>
                      {mappings.length === 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-12 text-center text-zinc-500"
                        >
                          Нет зарегистрированных участников
                        </motion.div>
                      ) : (
                        mappings.map((m) => (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center justify-between p-6 hover:bg-zinc-800/30 transition-colors group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-blue-500 group-hover:bg-blue-500/10 transition-colors">
                                <User className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-medium text-white flex items-center gap-2 capitalize">
                                  {m.nickname}
                                </div>
                                <div className="text-xs text-zinc-500 font-mono tracking-tight">
                                  ID: {m.telegramId}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteMapping(m.id)}
                              className="p-2 text-zinc-500 hover:text-red-400 transition-colors bg-transparent hover:bg-red-400/10 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Config Upload Side */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-xl">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-blue-500" />
                    Загрузить конфиг
                  </h2>
                  <div className="space-y-4">
                    <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-800 border-dashed rounded-xl cursor-pointer hover:bg-zinc-800/30 hover:border-blue-500/50 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Plus className={`w-8 h-8 mb-2 text-zinc-500 ${uploadLoading ? 'animate-spin' : ''}`} />
                        <p className="text-sm text-zinc-500">
                          {uploadLoading ? 'Загрузка...' : 'Выберите .conf файл'}
                        </p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".conf" 
                        onChange={handleFileUpload}
                        disabled={uploadLoading}
                      />
                    </label>
                    <div className="text-[10px] text-zinc-500 leading-normal bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                      📌 Убедитесь, что имя файла соответствует никнейму участника.<br/>
                      Пример: <span className="text-zinc-300">sanya_iphone.conf</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Config List Side */}
              <div className="lg:col-span-8">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-xl">
                  <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
                    <h2 className="font-semibold">Список файлов</h2>
                    <span className="text-xs font-mono px-2 py-1 bg-zinc-800 rounded-md text-zinc-500">
                      {configs.length} FILES
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-800/50 max-h-[600px] overflow-auto">
                    <AnimatePresence mode='popLayout'>
                      {configs.length === 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-12 text-center text-zinc-500"
                        >
                          Файлы конфигураций не найдены
                        </motion.div>
                      ) : (
                        configs.sort((a,b) => b.updatedAt - a.updatedAt).map((c) => (
                          <motion.div
                            key={c.id}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center justify-between p-6 hover:bg-zinc-800/30 transition-colors group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-blue-500 transition-colors">
                                <Smartphone className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-medium text-white flex items-center gap-2">
                                  {c.fileName}
                                </div>
                                <div className="text-xs text-zinc-500 flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 bg-zinc-800 rounded capitalize">{c.nickname}</span>
                                  <span>•</span>
                                  <span>{new Date(c.updatedAt).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteConfig(c.id)}
                              className="p-2 text-zinc-500 hover:text-red-400 transition-colors bg-transparent hover:bg-red-400/10 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
