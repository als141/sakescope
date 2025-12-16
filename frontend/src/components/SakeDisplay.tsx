'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { MapPin, Thermometer, Wine, DollarSign, Utensils, ShoppingBag, ExternalLink, Sparkles, Search, Heart } from 'lucide-react';
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
import { PreferenceRadar } from '@/components/PreferenceRadar';
import { feedbackFormUrl } from '@/lib/feedback';

interface SakeDisplayProps {
  sake: Sake;
  offer: PurchaseOffer | null;
  onReset: () => void;
  /**
   * Secondary CTA label (used in embed variant).
   */
  secondaryActionLabel?: string;
  /**
   * Show preference radar/section (disable in gift-mode pages that already render it elsewhere).
   */
  showPreferenceMap?: boolean;
  /**
   * Display variant. "embed" is a compact card for iframe embedding.
   */
  variant?: 'full' | 'embed';
}

export default function SakeDisplay({
  sake,
  offer,
  onReset,
  secondaryActionLabel,
  showPreferenceMap = true,
  variant = 'full',
}: SakeDisplayProps) {
  const [imageError, setImageError] = useState(false);
  const formatPrice = (value: number) => `¥${value.toLocaleString()}`;
  const purchaseShops = offer?.shops ?? [];
  const flavorProfile = sake.flavorProfile ?? null;
  const tastingNotes = sake.tastingNotes ?? [];
  const servingTemperatures = sake.servingTemperature ?? [];
  const foodPairing = sake.foodPairing ?? [];
  const preferenceMap = showPreferenceMap ? offer?.preferenceMap ?? null : null;
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(sake.name)}`;

  // Handle shop link click (notify parent if in iframe)
  const handleShopClick = (shop: typeof purchaseShops[0]) => {
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({
        type: 'sakescope:shopClick',
        sake,
        shop
      }, '*');
    }
  };

  if (variant === 'embed') {
    const primaryShop = purchaseShops[0];
    const secondaryLabel = secondaryActionLabel ?? '他の日本酒も見る';

    return (
      <motion.div
        className="w-full"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden bg-background">
          <CardHeader className="p-4 pb-3">
            <div className="flex gap-4">
              <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-muted/30 border border-border/60">
                {sake.imageUrl && !imageError ? (
                  <Image
                    src={sake.imageUrl}
                    alt={`${sake.name}のイメージ`}
                    fill
                    sizes="96px"
                    className="object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Wine className="h-10 w-10 text-primary/70" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold leading-snug truncate">
                    {sake.name}
                  </h2>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
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

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {sake.region && (
                    <Badge variant="secondary" size="sm">
                      {sake.region}
                    </Badge>
                  )}
                  {sake.type && (
                    <Badge variant="secondary" size="sm">
                      {sake.type}
                    </Badge>
                  )}
                  {sake.priceRange && (
                    <Badge variant="outline" size="sm">
                      {sake.priceRange}
                    </Badge>
                  )}
                </div>

                {offer?.summary && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {offer.summary}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-0 space-y-3">
            {tastingNotes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tastingNotes.slice(0, 6).map((note, index) => (
                  <Badge key={index} variant="outline" size="sm">
                    {note}
                  </Badge>
                ))}
              </div>
            )}

            {purchaseShops.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {purchaseShops.slice(0, 2).map((shop) => (
                  <a
                    key={`${shop.retailer}-${shop.url}`}
                    href={shop.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                    onClick={() => handleShopClick(shop)}
                  >
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-3 py-2 hover:border-primary/50 hover:bg-accent/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {shop.retailer}
                        </p>
                        <p className="text-sm font-bold text-primary">
                          {shop.price ? formatPrice(shop.price) : shop.priceText ?? '価格を確認'}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                購入先の情報を確認中です。
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {primaryShop && (
                <Button asChild size="default" className="w-full sm:w-auto flex-1">
                  <a
                    href={primaryShop.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleShopClick(primaryShop)}
                  >
                    商品ページを見る
                  </a>
                </Button>
              )}
              <Button
                onClick={onReset}
                variant="outline"
                size="default"
                className="w-full sm:w-auto flex-1"
              >
                {secondaryLabel}
              </Button>
            </div>

            <div className="flex justify-end">
              <a
                href={feedbackFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                体験アンケート（任意）
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="w-full min-h-screen flex flex-col px-0 sm:px-6 lg:px-12 pt-20 sm:pt-24 lg:pt-28 pb-16 sm:pb-20 gap-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Main Card - Scrollable */}
      <Card className="shadow-2xl border-border/40 flex-1 flex flex-col min-h-0 w-full max-w-5xl mx-auto rounded-none sm:rounded-3xl border-x-0 sm:border">
        <div className="flex-1">
          {/* Header Section */}
          <CardHeader className="p-4 sm:p-8 pb-5 sm:pb-6">
            <div className="flex flex-col lg:flex-row gap-5 sm:gap-8">
              {/* Image */}
              <motion.div
                className="relative flex-shrink-0 w-full lg:w-80 h-56 sm:h-72 lg:h-96 overflow-hidden rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50"
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
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text leading-tight pr-2">
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

                    {purchaseShops.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {purchaseShops.map((shop) => (
                          <a
                            key={`${shop.retailer}-${shop.url}`}
                            href={shop.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                            onClick={() => handleShopClick(shop)}
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
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                        購入先の詳細は現在取得中です。店頭・公式ショップでの在庫をご確認ください。
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
              {preferenceMap?.axes?.length ? (
                <AccordionItem value="preferences">
                  <AccordionTrigger className="text-base sm:text-lg font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-primary" />
                      <span>あなたの好み</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2 space-y-3 flex flex-col items-center">
                      <PreferenceRadar
                        axes={preferenceMap.axes}
                        size={260}
                        className="text-primary"
                        title={preferenceMap.title ?? '嗜好マップ'}
                      />
                      {preferenceMap.summary && (
                        <p className="text-sm text-muted-foreground text-center leading-relaxed">
                          {preferenceMap.summary}
                        </p>
                      )}
                      {preferenceMap.notes && (
                        <p className="text-xs text-muted-foreground text-center leading-relaxed">
                          {preferenceMap.notes}
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ) : null}

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
            <div className="flex justify-center pt-2">
              <a
                href={feedbackFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                体験アンケート（任意）
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}
