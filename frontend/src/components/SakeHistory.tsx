'use client';

import { useState, useEffect } from 'react';
import { History, Trash2, Wine, Clock } from 'lucide-react';
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
          size="icon-lg"
          className="fixed left-4 sm:left-6 lg:left-10 top-24 sm:top-28 z-40 rounded-full shadow-xl glass border-border/50 hover:shadow-2xl hover:scale-105 hover:border-primary/50 transition-all backdrop-blur-md"
        >
          <History className="h-5 w-5 sm:h-6 sm:w-6" />
          {history.length > 0 && (
            <Badge
              variant="default"
              size="sm"
              className="absolute -top-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center p-0 text-[9px] sm:text-[10px] font-bold rounded-full shadow-md"
            >
              {history.length > 9 ? '9+' : history.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 sm:px-8 py-6 sm:py-8 border-b border-border/50">
          <SheetTitle className="flex items-center gap-3 sm:gap-4 text-2xl sm:text-3xl">
            <div className="rounded-2xl bg-primary/10 p-2.5 sm:p-3 border border-primary/20">
              <History className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <span className="gradient-text font-bold">レコメンド履歴</span>
          </SheetTitle>
          <SheetDescription className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            過去にレコメンドされた日本酒
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 sm:p-6">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[320px] sm:min-h-[400px] text-center space-y-6 sm:space-y-8 px-6 sm:px-8">
                <div className="rounded-full bg-muted/50 p-8 sm:p-10 border-2 border-dashed border-border/50">
                  <Wine className="h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground" />
                </div>
                <div className="space-y-2.5 sm:space-y-3">
                  <p className="text-lg sm:text-xl font-bold text-foreground">
                    まだ履歴がありません
                  </p>
                  <p className="text-sm sm:text-base text-muted-foreground max-w-sm leading-relaxed">
                    AIソムリエと会話して日本酒を探してみましょう。レコメンドされた日本酒は自動的にここに保存されます。
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className={cn(
                      "group relative rounded-2xl border-2 border-border/50 bg-card p-4 sm:p-5",
                      "cursor-pointer transition-all duration-300",
                      "hover:border-primary/50 hover:bg-accent/30 hover:shadow-lg hover:-translate-y-1",
                      "active:translate-y-0 active:scale-[0.98]",
                      "focus-within:outline-none focus-within:ring-4 focus-within:ring-ring/20 focus-within:border-primary"
                    )}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectItem(item);
                      }
                    }}
                  >
                    <div className="flex gap-4 sm:gap-5">
                      {/* Image */}
                      <div className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-gradient-to-br from-muted/50 to-muted/30 border-2 border-border/30 group-hover:border-primary/30 transition-colors">
                        {item.sake.imageUrl ? (
                          <Image
                            src={item.sake.imageUrl}
                            alt={item.sake.name}
                            width={120}
                            height={120}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Wine className="h-10 w-10 sm:h-12 sm:w-12 text-primary/60 group-hover:text-primary transition-colors" />
                          </div>
                        )}
                      </div>

                      {/* Info エリア */}
                      <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                        <h3 className="font-semibold text-sm sm:text-base leading-tight group-hover:text-primary transition-colors">
                          {item.sake.name}
                        </h3>
                        {item.sake.brewery && (
                          <p className="text-sm text-muted-foreground leading-tight">
                            {item.sake.brewery}
                          </p>
                        )}
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          {item.sake.type && (
                            <Badge variant="secondary" size="sm">
                              {item.sake.type}
                            </Badge>
                          )}
                          <span className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            {formatDate(item.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <Button
                        onClick={(e) => handleRemoveItem(item.id, e)}
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "flex-shrink-0 rounded-xl",
                          "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                          "opacity-0 group-hover:opacity-100 transition-all duration-200",
                          "focus-visible:opacity-100"
                        )}
                      >
                        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {history.length > 0 && (
          <>
            <Separator />
            <SheetFooter className="p-5 sm:p-6">
              <Button
                onClick={handleClearAll}
                variant="destructive"
                className="w-full"
                size="lg"
              >
                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                全ての履歴を削除
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
