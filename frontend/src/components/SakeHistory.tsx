'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, Trash2, Wine } from 'lucide-react';
import Image from 'next/image';
import { SakeHistoryStorage, type SakeHistoryItem } from '@/infrastructure/storage/sakeHistoryStorage';

interface SakeHistoryProps {
  onSelectSake: (item: SakeHistoryItem) => void;
}

export default function SakeHistory({ onSelectSake }: SakeHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<SakeHistoryItem[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const items = SakeHistoryStorage.getHistory();
    setHistory(items);
  };

  const handleRemoveItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    SakeHistoryStorage.removeItem(id);
    loadHistory();
  };

  const handleClearAll = () => {
    if (window.confirm('全ての履歴を削除しますか？')) {
      SakeHistoryStorage.clearHistory();
      loadHistory();
    }
  };

  const handleSelectItem = (item: SakeHistoryItem) => {
    onSelectSake(item);
    setIsOpen(false);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'たった今';
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Open Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-20 z-40 p-3 rounded-full glass hover:bg-gray-700/50 transition-colors inline-flex items-center gap-2 sm:left-8"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="レコメンド履歴"
      >
        <History className="w-5 h-5 text-amber-400" />
        {history.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {history.length > 9 ? '9+' : history.length}
          </span>
        )}
      </motion.button>

      {/* History Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              className="fixed left-0 top-0 bottom-0 w-full sm:w-96 bg-gradient-to-b from-gray-900 to-black border-r border-gray-700/50 z-50 overflow-hidden flex flex-col"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold gradient-text flex items-center gap-2">
                    <History className="w-6 h-6" />
                    レコメンド履歴
                  </h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-full hover:bg-gray-700/50 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <p className="text-sm text-gray-400">
                  過去にレコメンドされた日本酒
                </p>
              </div>

              {/* History List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                    <Wine className="w-16 h-16 text-gray-600" />
                    <p className="text-gray-400">
                      まだレコメンドの履歴がありません
                    </p>
                    <p className="text-sm text-gray-500">
                      AIソムリエと会話して日本酒を探してみましょう
                    </p>
                  </div>
                ) : (
                  <>
                    {history.map((item, index) => (
                      <motion.div
                        key={item.id}
                        className="glass rounded-lg p-3 cursor-pointer hover:bg-gray-800/50 transition-all border border-transparent hover:border-amber-500/30"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleSelectItem(item)}
                      >
                        <div className="flex gap-3">
                          {/* Image */}
                          <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-amber-600/20 to-orange-600/20">
                            {item.sake.imageUrl ? (
                              <Image
                                src={item.sake.imageUrl}
                                alt={item.sake.name}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Wine className="w-6 h-6 text-amber-400" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-sm truncate">
                              {item.sake.name}
                            </h3>
                            {item.sake.brewery && (
                              <p className="text-gray-400 text-xs truncate">
                                {item.sake.brewery}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {item.sake.type && (
                                <span className="text-xs px-2 py-0.5 bg-amber-600/20 text-amber-400 rounded">
                                  {item.sake.type}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {formatDate(item.timestamp)}
                              </span>
                            </div>
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={(e) => handleRemoveItem(item.id, e)}
                            className="flex-shrink-0 p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </>
                )}
              </div>

              {/* Footer */}
              {history.length > 0 && (
                <div className="p-4 border-t border-gray-700/50">
                  <button
                    onClick={handleClearAll}
                    className="w-full px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    全ての履歴を削除
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
