'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { MapPin, Thermometer, Wine, DollarSign, Utensils, ShoppingBag, ExternalLink, Sparkles, Search } from 'lucide-react';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  const [imageError, setImageError] = useState(false);
  const formatPrice = (value: number) => `¥${value.toLocaleString()}`;
  const purchaseShops = offer?.shops ?? [];
  const flavorProfile = sake.flavorProfile ?? null;
  const tastingNotes = sake.tastingNotes ?? [];
  const servingTemperatures = sake.servingTemperature ?? [];
  const foodPairing = sake.foodPairing ?? [];
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(sake.name)}`;

  return (
    <motion.div
      className="w-full h-screen flex flex-col px-6 sm:px-8 lg:px-12 pt-24 sm:pt-28 lg:pt-32 pb-6 sm:pb-8 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Main Card - Scrollable */}
      <Card className="overflow-hidden shadow-2xl border-border/40 flex-1 flex flex-col min-h-0 max-w-7xl mx-auto w-full">
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
                {sake.imageUrl && !imageError ? (
                  <>
                    <Image
                      src={sake.imageUrl}
                      alt={`${sake.name}のイメージ`}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 20rem, 100vw"
                      priority
                      onError={() => setImageError(true)}
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
                    <div className="rounded-full bg-primary/10 p-8">
                      <Wine className="h-16 w-16 sm:h-20 sm:w-20 text-primary" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-foreground mb-1">
                        {sake.name}
                      </h3>
                      {sake.brewery && (
                        <p className="text-sm text-muted-foreground">
                          {sake.brewery}
                        </p>
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
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text leading-tight">
                        {sake.name}
                      </h1>
                      <Button
                        asChild
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <a
                          href={googleSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${sake.name} をGoogleで検索`}
                        >
                          <Search className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
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
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {sake.description ?? '詳細データを取得しています。'}
                  </p>
                </motion.div>

                {/* Technical Specs - Compact */}
                {(sake.alcohol || sake.sakeValue || sake.acidity) && (
                  <motion.div
                    className="flex gap-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  >
                    {sake.alcohol && (
                      <div className="text-xs bg-primary/10 border border-primary/20 rounded-lg px-2 py-1 flex items-center gap-1">
                        <span className="font-bold text-primary">{sake.alcohol}%</span>
                        <span className="text-muted-foreground">度数</span>
                      </div>
                    )}
                    {sake.sakeValue && (
                      <div className="text-xs bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1 flex items-center gap-1">
                        <span className="font-bold text-blue-500">{sake.sakeValue}</span>
                        <span className="text-muted-foreground">日本酒度</span>
                      </div>
                    )}
                    {sake.acidity && (
                      <div className="text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1 flex items-center gap-1">
                        <span className="font-bold text-emerald-500">{sake.acidity}</span>
                        <span className="text-muted-foreground">酸度</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Purchase Information */}
                {offer && (
                  <motion.div
                    className="space-y-3 pt-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">購入情報</h3>
                    </div>

                    {offer.summary && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {offer.summary}
                      </p>
                    )}

                    {purchaseShops.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {purchaseShops.map((shop) => (
                          <a
                            key={`${shop.retailer}-${shop.url}`}
                            href={shop.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            <Card className="h-full hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer">
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-semibold text-sm text-primary">{shop.retailer}</span>
                                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <div className="text-base sm:text-lg font-bold mb-1">
                                  {shop.price ? formatPrice(shop.price) : shop.priceText ?? '価格を確認'}
                                </div>
                                {shop.availability && (
                                  <p className="text-xs text-muted-foreground">在庫: {shop.availability}</p>
                                )}
                                {shop.deliveryEstimate && (
                                  <p className="text-xs text-muted-foreground">配送: {shop.deliveryEstimate}</p>
                                )}
                              </CardContent>
                            </Card>
                          </a>
                        ))}
                      </div>
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
