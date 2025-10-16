'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft, MapPin, Thermometer, Wine, DollarSign, Utensils, ShoppingBag, Info, ExternalLink, Sparkles } from 'lucide-react';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface SakeDisplayProps {
  sake: Sake;
  offer: PurchaseOffer | null;
  onReset: () => void;
}

export default function SakeDisplay({ sake, offer, onReset }: SakeDisplayProps) {
  const formatPrice = (value: number) => `¥${value.toLocaleString()}`;
  const purchaseShops = offer?.shops ?? [];
  const flavorProfile = sake.flavorProfile ?? null;
  const tastingNotes = sake.tastingNotes ?? [];
  const servingTemperatures = sake.servingTemperature ?? [];
  const foodPairing = sake.foodPairing ?? [];

  return (
    <motion.div
      className="w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Back Button */}
      <Button
        onClick={onReset}
        variant="ghost"
        size="lg"
        className="mb-8 sm:mb-10 -ml-2 group"
      >
        <ArrowLeft className="mr-2 sm:mr-2.5 h-4 w-4 sm:h-5 sm:w-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm sm:text-base">他の日本酒を探す</span>
      </Button>

      {/* Main Card */}
      <Card className="overflow-hidden shadow-2xl border-border/40">
        {/* Header Section */}
        <CardHeader className="p-6 sm:p-8 lg:p-10 pb-8 sm:pb-10">
          <div className="flex flex-col lg:flex-row gap-8 sm:gap-10 lg:gap-12">
            {/* Image */}
            <motion.div
              className="relative flex-shrink-0 w-full lg:w-96 h-80 sm:h-96 overflow-hidden rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border-2 border-border/50"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              {sake.imageUrl ? (
                <>
                  <Image
                    src={sake.imageUrl}
                    alt={`${sake.name}のイメージ`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 24rem, 100vw"
                    priority
                  />
                  {/* グラデーションオーバーレイ */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  
                  {/* 画像内の情報 */}
                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 space-y-2">
                    {sake.type && (
                      <Badge 
                        variant="default" 
                        size="lg"
                        className="backdrop-blur-md bg-white/20 border-white/30 text-white shadow-lg"
                      >
                        {sake.type}
                      </Badge>
                    )}
                    <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
                      {sake.name}
                    </h2>
                    {sake.brewery && (
                      <p className="text-sm text-white/90 drop-shadow">
                        {sake.brewery}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center space-y-4 p-6">
                  <div className="rounded-full bg-primary/10 p-6">
                    <Wine className="h-20 w-20 text-primary" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      {sake.name}
                    </h2>
                    {sake.brewery && (
                      <p className="text-base text-muted-foreground">
                        {sake.brewery}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Sake Information */}
            <div className="flex-1 space-y-6 sm:space-y-8">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                {/* タイトルエリア */}
                <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold gradient-text leading-tight">
                    {sake.name}
                  </h1>
                  
                  {/* メタ情報 */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    {sake.region && (
                      <div className="flex items-center gap-2 text-base text-muted-foreground">
                        <MapPin className="h-5 w-5" />
                        <span className="font-medium">{sake.region}</span>
                      </div>
                    )}
                    {sake.type && (
                      <Badge variant="secondary" size="lg">
                        {sake.type}
                      </Badge>
                    )}
                    {sake.priceRange && (
                      <div className="flex items-center gap-2 text-base text-muted-foreground">
                        <DollarSign className="h-5 w-5" />
                        <span className="font-medium">{sake.priceRange}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 説明文 */}
                <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
                  {sake.description ?? '詳細データを取得しています。'}
                </p>
              </motion.div>

              {/* Technical Specs */}
              {(sake.alcohol || sake.sakeValue || sake.acidity) && (
                <motion.div
                  className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  {sake.alcohol && (
                    <Card className="text-center p-4 sm:p-5 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:border-primary/40 transition-all duration-300">
                      <div className="text-2xl sm:text-3xl font-bold text-primary mb-1.5 sm:mb-2">
                        {sake.alcohol}%
                      </div>
                      <div className="text-xs font-medium text-muted-foreground tracking-wide">
                        アルコール度数
                      </div>
                    </Card>
                  )}
                  {sake.sakeValue && (
                    <Card className="text-center p-5 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20 hover:border-blue-500/40 transition-all duration-300">
                      <div className="text-3xl font-bold text-blue-500 mb-2">
                        {sake.sakeValue}
                      </div>
                      <div className="text-xs font-medium text-muted-foreground tracking-wide">
                        日本酒度
                      </div>
                    </Card>
                  )}
                  {sake.acidity && (
                    <Card className="text-center p-5 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300">
                      <div className="text-3xl font-bold text-emerald-500 mb-2">
                        {sake.acidity}
                      </div>
                      <div className="text-xs font-medium text-muted-foreground tracking-wide">
                        酸度
                      </div>
                    </Card>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="p-6 sm:p-8 pt-6 sm:pt-8 space-y-6 sm:space-y-8">
          {/* Tabs for organized content */}
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid h-auto">
              <TabsTrigger value="profile" className="gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">味わい</span>
              </TabsTrigger>
              <TabsTrigger value="pairing" className="gap-2">
                <Utensils className="h-4 w-4" />
                <span className="hidden sm:inline">楽しみ方</span>
              </TabsTrigger>
              {offer && (
                <TabsTrigger value="purchase" className="gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="hidden sm:inline">購入</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Flavor Profile Tab */}
            <TabsContent value="profile" className="mt-6 sm:mt-8">
              {(flavorProfile || tastingNotes.length > 0) && (
            <div className="space-y-6 sm:space-y-8">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                <h3 className="text-xl sm:text-2xl font-bold gradient-text">味わいの特徴</h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                {flavorProfile && (
                  <div className="space-y-5 sm:space-y-6">
                    {[
                      { label: '甘み', value: flavorProfile?.sweetness, color: 'pink', emoji: '🍬' },
                      { label: '軽やかさ', value: flavorProfile?.lightness, color: 'blue', emoji: '💨' },
                      { label: '複雑さ', value: flavorProfile?.complexity, color: 'purple', emoji: '🌟' },
                      { label: 'フルーティさ', value: flavorProfile?.fruitiness, color: 'green', emoji: '🍇' },
                    ]
                      .filter((entry) => typeof entry.value === 'number')
                      .map((flavor, index) => (
                        <div key={flavor.label} className="space-y-2.5 sm:space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm sm:text-base font-semibold flex items-center gap-2 sm:gap-3">
                              <span className="text-xl sm:text-2xl">{flavor.emoji}</span>
                              <span>{flavor.label}</span>
                            </span>
                            <span className="text-base sm:text-lg font-bold text-foreground">
                              {(flavor.value as number).toFixed(1)}
                              <span className="text-xs sm:text-sm text-muted-foreground ml-1">/5.0</span>
                            </span>
                          </div>
                          
                          {/* プログレスバー */}
                          <div className="relative h-3 bg-muted/50 rounded-full overflow-hidden border border-border/50">
                            <motion.div
                              className={cn(
                                "h-full rounded-full relative overflow-hidden",
                                flavor.color === 'pink' && "bg-gradient-to-r from-pink-400 to-pink-600",
                                flavor.color === 'blue' && "bg-gradient-to-r from-blue-400 to-blue-600",
                                flavor.color === 'purple' && "bg-gradient-to-r from-purple-400 to-purple-600",
                                flavor.color === 'green' && "bg-gradient-to-r from-green-400 to-green-600"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${(((flavor.value as number) ?? 0) / 5) * 100}%` }}
                              transition={{ 
                                delay: 0.5 + index * 0.1, 
                                duration: 1, 
                                ease: [0.4, 0, 0.2, 1] 
                              }}
                            >
                              {/* 光沢エフェクト */}
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "linear",
                                  delay: index * 0.3,
                                }}
                              />
                            </motion.div>
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
            </div>
          )}
            </TabsContent>

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

            {/* Purchase Tab */}
            {offer && (
              <TabsContent value="purchase" className="mt-6 space-y-6">
                {/* Summary */}
                <Alert className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
                  <Info className="h-5 w-5 text-primary" />
                  <AlertDescription className="ml-0 mt-2 space-y-3">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-base text-foreground">ソムリエのリサーチ概要</h4>
                      <p className="text-sm leading-relaxed">{offer.summary}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{offer.reasoning}</p>
                    </div>
                    {offer.tastingHighlights && offer.tastingHighlights.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {offer.tastingHighlights.map((note) => (
                          <Badge key={note} variant="secondary" className="text-xs">
                            {note}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {offer.servingSuggestions && offer.servingSuggestions.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">おすすめ: </span>
                        {offer.servingSuggestions.join(' / ')}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground/70">
                      最終更新: {new Date(offer.updatedAt).toLocaleString()}
                    </p>
                  </AlertDescription>
                </Alert>

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
                  <Alert className="border-dashed border-primary/30 bg-primary/5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <AlertDescription className="ml-0 mt-2 text-sm">
                      {offer.followUpPrompt}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            )}
          </Tabs>
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
