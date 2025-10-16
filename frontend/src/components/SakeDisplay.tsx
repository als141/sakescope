'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft, MapPin, Thermometer, Wine, DollarSign, Utensils, ShoppingBag, Info, ExternalLink, Sparkles, ChevronDown } from 'lucide-react';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
      className="w-full h-screen flex flex-col px-6 sm:px-8 lg:px-12 py-6 sm:py-8 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Back Button */}
      <Button
        onClick={onReset}
        variant="ghost"
        size="lg"
        className="mb-4 group flex-shrink-0"
      >
        <ArrowLeft className="mr-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm sm:text-base">他の日本酒を探す</span>
      </Button>

      {/* Main Card - Scrollable */}
      <Card className="overflow-hidden shadow-2xl border-border/40 flex-1 flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          {/* Header Section */}
          <CardHeader className="p-6 sm:p-8 pb-6">
            <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
              {/* Image */}
              <motion.div
                className="relative flex-shrink-0 w-full lg:w-80 h-64 sm:h-80 lg:h-96 overflow-hidden rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border-2 border-border/50"
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
                      sizes="(min-width: 1024px) 20rem, 100vw"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 space-y-2">
                      {sake.type && (
                        <Badge variant="default" size="default" className="backdrop-blur-md bg-white/20 border-white/30 text-white shadow-lg">
                          {sake.type}
                        </Badge>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center space-y-4 p-6">
                    <div className="rounded-full bg-primary/10 p-6">
                      <Wine className="h-16 w-16 text-primary" />
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Sake Information */}
              <div className="flex-1 space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <div className="space-y-3 mb-4">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text leading-tight">
                      {sake.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {sake.region && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span className="font-medium">{sake.region}</span>
                        </div>
                      )}
                      {sake.type && (
                        <Badge variant="secondary" size="default">
                          {sake.type}
                        </Badge>
                      )}
                      {sake.priceRange && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          <span className="font-medium">{sake.priceRange}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed line-clamp-3">
                    {sake.description ?? '詳細データを取得しています。'}
                  </p>
                </motion.div>

                {/* Technical Specs */}
                {(sake.alcohol || sake.sakeValue || sake.acidity) && (
                  <motion.div
                    className="grid grid-cols-3 gap-3"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  >
                    {sake.alcohol && (
                      <Card className="text-center p-3 sm:p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                        <div className="text-xl sm:text-2xl font-bold text-primary mb-1">
                          {sake.alcohol}%
                        </div>
                        <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                          アルコール
                        </div>
                      </Card>
                    )}
                    {sake.sakeValue && (
                      <Card className="text-center p-3 sm:p-4 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
                        <div className="text-xl sm:text-2xl font-bold text-blue-500 mb-1">
                          {sake.sakeValue}
                        </div>
                        <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                          日本酒度
                        </div>
                      </Card>
                    )}
                    {sake.acidity && (
                      <Card className="text-center p-3 sm:p-4 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
                        <div className="text-xl sm:text-2xl font-bold text-emerald-500 mb-1">
                          {sake.acidity}
                        </div>
                        <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">
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

          <CardContent className="p-6 sm:p-8 pt-4 sm:pt-6 space-y-4">
            {/* Accordion for detailed information */}
            <Accordion type="multiple" className="w-full">
              {/* Flavor Profile Accordion */}
              {(flavorProfile || tastingNotes.length > 0) && (
                <AccordionItem value="flavor">
                  <AccordionTrigger className="text-base sm:text-lg font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <span>味わいの特徴</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-2">
                      {flavorProfile && (
                        <div className="space-y-4">
                          {[
                            { label: '甘み', value: flavorProfile?.sweetness, color: 'pink', emoji: '🍬' },
                            { label: '軽やかさ', value: flavorProfile?.lightness, color: 'blue', emoji: '💨' },
                            { label: '複雑さ', value: flavorProfile?.complexity, color: 'purple', emoji: '🌟' },
                            { label: 'フルーティさ', value: flavorProfile?.fruitiness, color: 'green', emoji: '🍇' },
                          ]
                            .filter((entry) => typeof entry.value === 'number')
                            .map((flavor, index) => (
                              <div key={flavor.label} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold flex items-center gap-2">
                                    <span className="text-lg">{flavor.emoji}</span>
                                    <span>{flavor.label}</span>
                                  </span>
                                  <span className="text-sm font-bold text-foreground">
                                    {(flavor.value as number).toFixed(1)}
                                    <span className="text-xs text-muted-foreground ml-1">/5.0</span>
                                  </span>
                                </div>
                                <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden border border-border/50">
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
                                    transition={{ delay: 0.5 + index * 0.1, duration: 1, ease: [0.4, 0, 0.2, 1] }}
                                  />
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                      {tastingNotes.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">テイスティングノート</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {tastingNotes.map((note, index) => (
                              <Badge key={index} variant="secondary" size="sm">
                                {note}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Serving & Pairing Accordion */}
              {(servingTemperatures.length > 0 || foodPairing.length > 0) && (
                <AccordionItem value="pairing">
                  <AccordionTrigger className="text-base sm:text-lg font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-5 w-5 text-primary" />
                      <span>楽しみ方</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {servingTemperatures.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Thermometer className="h-4 w-4 text-primary" />
                            おすすめ飲み方
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {servingTemperatures.map((temp, index) => (
                              <Badge key={index} variant="outline" size="sm">
                                {temp}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {foodPairing.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Utensils className="h-4 w-4 text-primary" />
                            相性の良い料理
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {foodPairing.map((food, index) => (
                              <Badge key={index} variant="outline" size="sm">
                                {food}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Purchase Accordion */}
              {offer && (
                <AccordionItem value="purchase">
                  <AccordionTrigger className="text-base sm:text-lg font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                      <span>購入情報</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <Alert className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
                        <Info className="h-4 w-4 text-primary" />
                        <AlertDescription className="ml-0 mt-2 space-y-2">
                          <div className="space-y-1">
                            <h4 className="font-semibold text-sm text-foreground">ソムリエのリサーチ</h4>
                            <p className="text-xs leading-relaxed">{offer.summary}</p>
                          </div>
                        </AlertDescription>
                      </Alert>

                      {purchaseShops.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">購入先</h4>
                          <div className="space-y-2">
                            {purchaseShops.map((shop) => (
                              <a
                                key={`${shop.retailer}-${shop.url}`}
                                href={shop.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                              >
                                <Card className="hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer">
                                  <CardContent className="p-3">
                                    <div className="flex justify-between items-start mb-1">
                                      <span className="font-semibold text-sm text-primary">{shop.retailer}</span>
                                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>
                                    <div className="text-lg font-bold">
                                      {shop.price ? formatPrice(shop.price) : shop.priceText ?? '価格を確認'}
                                    </div>
                                    {shop.availability && (
                                      <p className="text-xs text-muted-foreground mt-1">在庫: {shop.availability}</p>
                                    )}
                                  </CardContent>
                                </Card>
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">販売先情報を取得中です。</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={onReset}
                variant="outline"
                size="lg"
                className="w-full"
              >
                他の日本酒も見る
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}
