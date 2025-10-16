'use client';

import { useState, useEffect } from 'react';
import { History, X, Trash2, Wine } from 'lucide-react';
import Image from 'next/image';
import { SakeHistoryStorage, type SakeHistoryItem } from '@/infrastructure/storage/sakeHistoryStorage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed left-4 top-20 z-40 h-12 w-12 rounded-full shadow-xl glass border-border/50 hover:shadow-2xl hover:scale-105 transition-all sm:left-8"
        >
          <History className="h-5 w-5" />
          {history.length > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] font-bold rounded-full"
            >
              {history.length > 9 ? '9+' : history.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <History className="h-6 w-6 text-primary" />
            <span className="gradient-text">レコメンド履歴</span>
          </SheetTitle>
          <SheetDescription>
            過去にレコメンドされた日本酒
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-4 px-4">
              <div className="rounded-full bg-muted/50 p-6">
                <Wine className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-muted-foreground font-medium">
                  まだレコメンドの履歴がありません
                </p>
                <p className="text-sm text-muted-foreground/70">
                  AIソムリエと会話して日本酒を探してみましょう
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className={cn(
                    "w-full text-left rounded-xl border border-border/50 bg-card p-3",
                    "hover:border-primary/50 hover:bg-accent/50 transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  )}
                >
                  <div className="flex gap-3">
                    {/* Image */}
                    <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted/50 border border-border/30">
                      {item.sake.imageUrl ? (
                        <Image
                          src={item.sake.imageUrl}
                          alt={item.sake.name}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Wine className="h-8 w-8 text-primary/60" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate mb-1">
                        {item.sake.name}
                      </h3>
                      {item.sake.brewery && (
                        <p className="text-xs text-muted-foreground truncate mb-2">
                          {item.sake.brewery}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.sake.type && (
                          <Badge variant="secondary" className="text-xs h-5">
                            {item.sake.type}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(item.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Delete Button */}
                    <Button
                      onClick={(e) => handleRemoveItem(item.id, e)}
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {history.length > 0 && (
          <>
            <Separator />
            <SheetFooter className="p-4">
              <Button
                onClick={handleClearAll}
                variant="destructive"
                className="w-full"
                size="sm"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                全ての履歴を削除
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
