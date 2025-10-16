'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft, MapPin, Thermometer, Wine, DollarSign, Utensils, ShoppingBag, Info, ExternalLink } from 'lucide-react';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface SakeDisplayProps {
  sake: Sake;
  offer: PurchaseOffer | null;
  onReset: () => void;
}

export default function SakeDisplay({ sake, offer, onReset }: SakeDisplayProps) {
  const getFlavorIcon = (value?: number | null) => {
    const icons = ['😐', '🙂', '😊', '😋', '🤤'];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '🙂';
    }
    return icons[Math.max(0, Math.min(4, Math.round(value) - 1))];
  };

  const formatPrice = (value: number) => `¥${value.toLocaleString()}`;
  const purchaseShops = offer?.shops ?? [];
  const flavorProfile = sake.flavorProfile ?? null;
  const tastingNotes = sake.tastingNotes ?? [];
  const servingTemperatures = sake.servingTemperature ?? [];
  const foodPairing = sake.foodPairing ?? [];

  return (
    <motion.div
      className="w-full max-w-5xl mx-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Back Button */}
      <Button
        onClick={onReset}
        variant="ghost"
        className="mb-6 -ml-2 hover:bg-accent"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        他の日本酒を探す
      </Button>

      {/* Main Card */}
      <Card className="overflow-hidden shadow-2xl border-border/50">
        {/* Header Section */}
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Image */}
            <motion.div
              className="relative flex-shrink-0 w-full lg:w-72 h-72 overflow-hidden rounded-xl bg-muted/30 border border-border/50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {sake.imageUrl ? (
                <>
                  <Image
                    src={sake.imageUrl}
                    alt={`${sake.name}のイメージ`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 18rem, 100vw"
                    unoptimized
                    priority={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 space-y-1">
                    <h2 className="text-lg font-semibold text-white">{sake.name}</h2>
                    {sake.brewery && (
                      <p className="text-sm text-white/90">{sake.brewery}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center space-y-3">
                  <Wine className="h-16 w-16 text-primary" />
                  <div className="text-center px-4">
                    <h2 className="text-xl font-bold text-foreground">{sake.name}</h2>
                    {sake.brewery && (
                      <p className="text-sm text-muted-foreground mt-1">{sake.brewery}</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Sake Information */}
            <div className="flex-1 space-y-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3"
              >
                <div>
                  <h1 className="text-3xl font-bold gradient-text mb-2">
                    {sake.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    {sake.region && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{sake.region}</span>
                      </div>
                    )}
                    {sake.type && (
                      <Badge variant="secondary">{sake.type}</Badge>
                    )}
                    {sake.priceRange && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span>{sake.priceRange}</span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {sake.description ?? '詳細データを取得しています。'}
                </p>
              </motion.div>

              {/* Technical Specs */}
              {(sake.alcohol || sake.sakeValue || sake.acidity || sake.brewery) && (
                <motion.div
                  className="grid grid-cols-2 lg:grid-cols-4 gap-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {sake.alcohol && (
                    <Card className="text-center p-3 bg-card/50 border-border/50">
                      <div className="text-2xl font-bold text-primary">{sake.alcohol}%</div>
                      <div className="text-xs text-muted-foreground mt-1">アルコール度数</div>
                    </Card>
                  )}
                  {sake.sakeValue && (
                    <Card className="text-center p-3 bg-card/50 border-border/50">
                      <div className="text-2xl font-bold text-blue-500">{sake.sakeValue}</div>
                      <div className="text-xs text-muted-foreground mt-1">日本酒度</div>
                    </Card>
                  )}
                  {sake.acidity && (
                    <Card className="text-center p-3 bg-card/50 border-border/50">
                      <div className="text-2xl font-bold text-emerald-500">{sake.acidity}</div>
                      <div className="text-xs text-muted-foreground mt-1">酸度</div>
                    </Card>
                  )}
                  {sake.brewery && (
                    <Card className="text-center p-3 bg-card/50 border-border/50">
                      <div className="text-xl font-bold text-purple-500 truncate">{sake.brewery}</div>
                      <div className="text-xs text-muted-foreground mt-1">酒蔵</div>
                    </Card>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </CardHeader>

        <Separator className="my-6" />

        <CardContent className="space-y-8">
          {/* Flavor Profile Section */}
          {(flavorProfile || tastingNotes.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <h3 className="text-xl font-semibold gradient-text">味わいの特徴</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {flavorProfile && (
                  <div className="space-y-4">
                    {[
                      { label: '甘み', value: flavorProfile?.sweetness, color: 'bg-pink-500' },
                      { label: '軽やかさ', value: flavorProfile?.lightness, color: 'bg-blue-500' },
                      { label: '複雑さ', value: flavorProfile?.complexity, color: 'bg-purple-500' },
                      { label: 'フルーティさ', value: flavorProfile?.fruitiness, color: 'bg-green-500' },
                    ]
                      .filter((entry) => typeof entry.value === 'number')
                      .map((flavor, index) => (
                        <div key={flavor.label} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium flex items-center gap-2">
                              <span className="text-xl">{getFlavorIcon(flavor.value)}</span>
                              {flavor.label}
                            </span>
                            <span className="text-sm font-bold">{(flavor.value as number).toFixed(1)}/5</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className={cn("h-full rounded-full", flavor.color)}
                              initial={{ width: 0 }}
                              animate={{ width: `${(((flavor.value as number) ?? 0) / 5) * 100}%` }}
                              transition={{ delay: 0.5 + index * 0.1, duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {tastingNotes.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold">テイスティングノート</h4>
                    <div className="flex flex-wrap gap-2">
                      {tastingNotes.map((note, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.6 + index * 0.05 }}
                        >
                          <Badge variant="secondary" className="px-3 py-1">
                            {note}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Serving & Pairing Section */}
          {(servingTemperatures.length > 0 || foodPairing.length > 0) && (
            <>
              <Separator />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {servingTemperatures.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <Thermometer className="h-5 w-5 text-primary" />
                      おすすめ飲み方
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {servingTemperatures.map((temp, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8 + index * 0.05 }}
                        >
                          <Badge variant="outline" className="px-3 py-1.5">
                            {temp}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {foodPairing.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <Utensils className="h-5 w-5 text-primary" />
                      相性の良い料理
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {foodPairing.map((food, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.9 + index * 0.05 }}
                        >
                          <Badge variant="outline" className="px-3 py-1.5">
                            {food}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </>
          )}

          {/* Purchase Information */}
          {offer && (
            <>
              <Separator />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="space-y-6"
              >
                {/* Summary */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Info className="h-5 w-5 text-primary" />
                      ソムリエのリサーチ概要
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="leading-relaxed">{offer.summary}</p>
                    <p className="text-muted-foreground leading-relaxed">{offer.reasoning}</p>
                    {offer.tastingHighlights && offer.tastingHighlights.length > 0 && (
                      <div className="space-y-1">
                        <span className="font-semibold text-primary">ハイライト: </span>
                        <span className="text-muted-foreground">{offer.tastingHighlights.join(' / ')}</span>
                      </div>
                    )}
                    {offer.servingSuggestions && offer.servingSuggestions.length > 0 && (
                      <div className="space-y-1">
                        <span className="font-semibold text-primary">おすすめの楽しみ方: </span>
                        <span className="text-muted-foreground">{offer.servingSuggestions.join(' / ')}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      最終更新: {new Date(offer.updatedAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                {/* Purchase Links */}
                <div className="space-y-4">
                  <h4 className="text-xl font-semibold flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    購入候補とリンク
                  </h4>

                  {purchaseShops.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {purchaseShops.map((shop) => (
                        <motion.a
                          key={`${shop.retailer}-${shop.url}`}
                          href={shop.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <Card className="h-full hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-semibold text-primary">{shop.retailer}</span>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="text-xl font-bold mb-3">
                                {shop.price ? formatPrice(shop.price) : shop.priceText ?? '価格を確認'}
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                {shop.availability && <p>在庫: {shop.availability}</p>}
                                {shop.deliveryEstimate && <p>配送: {shop.deliveryEstimate}</p>}
                                {shop.notes && <p>{shop.notes}</p>}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.a>
                      ))}
                    </div>
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="p-4 text-sm text-muted-foreground text-center">
                        信頼できる販売先を確認できませんでした。別の条件でもう一度調査するようリクエストしてみてください。
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Alternatives */}
                {offer.alternatives && offer.alternatives.length > 0 && (
                  <div className="space-y-4">
                    <h5 className="text-lg font-semibold">他の候補</h5>
                    <div className="space-y-3">
                      {offer.alternatives.map((alt, index) => (
                        <Card key={`${alt.sake.name}-${index}`} className="bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h6 className="font-semibold">{alt.sake.name}</h6>
                                {alt.sake.brewery && (
                                  <p className="text-xs text-muted-foreground">{alt.sake.brewery}</p>
                                )}
                              </div>
                              {alt.shops[0] && (
                                <Button variant="link" size="sm" asChild className="h-auto p-0">
                                  <a href={alt.shops[0].url} target="_blank" rel="noreferrer">
                                    最安値を見る
                                  </a>
                                </Button>
                              )}
                            </div>
                            <p className="text-sm mb-2">{alt.summary}</p>
                            <p className="text-xs text-muted-foreground mb-3">{alt.reasoning}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {alt.tastingHighlights?.map((note) => (
                                <Badge key={note} variant="secondary" className="text-xs">
                                  {note}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up Prompt */}
                {offer.followUpPrompt && (
                  <Card className="border-dashed border-primary/30 bg-primary/5">
                    <CardContent className="p-4 text-sm">
                      💡 {offer.followUpPrompt}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </>
          )}
        </CardContent>

        {/* Call to Action */}
        <Separator />
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:shadow-xl transition-all"
            >
              この日本酒を詳しく見る
            </Button>
            <Button
              onClick={onReset}
              variant="outline"
              size="lg"
            >
              他の日本酒も見る
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
