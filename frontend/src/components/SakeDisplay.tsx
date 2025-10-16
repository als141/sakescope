'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft, MapPin, Thermometer, Wine, DollarSign, Utensils, ShoppingBag, Info } from 'lucide-react';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';

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

  const getTemperatureColor = (temp: string) => {
    const colors: { [key: string]: string } = {
      '冷酒': 'text-blue-400',
      '常温': 'text-green-400',
      'ぬる燗': 'text-orange-400',
      '熱燗': 'text-red-400'
    };
    return colors[temp] || 'text-gray-400';
  };

  const formatPrice = (value: number) => `¥${value.toLocaleString()}`;
  const purchaseShops = offer?.shops ?? [];
  const flavorProfile = sake.flavorProfile ?? null;
  const tastingNotes = sake.tastingNotes ?? [];
  const servingTemperatures = sake.servingTemperature ?? [];
  const foodPairing = sake.foodPairing ?? [];

  return (
    <motion.div
      className="w-full max-w-4xl mx-auto"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Back Button */}
      <motion.button
        onClick={onReset}
        className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        whileHover={{ scale: 1.05, x: -5 }}
        whileTap={{ scale: 0.95 }}
      >
        <ArrowLeft className="w-5 h-5" />
        <span>他の日本酒を探す</span>
      </motion.button>

      {/* Main Card */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        layoutId="sake-card"
      >
        {/* Header Section */}
        <div className="relative p-8 pb-0">
          {/* Sake Bottle Illustration Placeholder */}
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <motion.div
              className="relative flex-shrink-0 w-full lg:w-80 h-80 overflow-hidden rounded-xl bg-gradient-to-br from-amber-600/20 to-orange-600/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {sake.imageUrl ? (
                <>
                  <Image
                    src={sake.imageUrl}
                    alt={`${sake.name}のイメージ`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 20rem, 100vw"
                    unoptimized
                    priority={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 text-white">
                    <div className="text-lg font-semibold">{sake.name}</div>
                    {sake.brewery && (
                      <div className="text-sm text-gray-200">{sake.brewery}</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
                  <Wine className="w-16 h-16 text-amber-400" />
                  <div className="text-2xl font-bold text-amber-400">{sake.name}</div>
                  <div className="text-lg text-gray-300">{sake.brewery}</div>
                </div>
              )}
            </motion.div>

            {/* Sake Information */}
            <div className="flex-1 space-y-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h1 className="text-4xl font-bold gradient-text mb-2">
                  {sake.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-gray-300 mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{sake.region ?? '地域情報なし'}</span>
                  </div>
                  <div className="px-3 py-1 bg-amber-600/20 rounded-full text-amber-400 text-sm font-medium">
                    {sake.type ?? 'スタイル情報なし'}
                  </div>
                  {sake.priceRange && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      <span>{sake.priceRange}</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-300 text-lg leading-relaxed">
                  {sake.description ?? '詳細データを取得しています。'}
                </p>
              </motion.div>

              {/* Technical Specs */}
              {(sake.alcohol || sake.sakeValue || sake.acidity || sake.brewery) && (
                <motion.div
                  className="grid grid-cols-2 lg:grid-cols-4 gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {sake.alcohol && (
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-400">{sake.alcohol}%</div>
                      <div className="text-sm text-gray-400">アルコール度数</div>
                    </div>
                  )}
                  {sake.sakeValue && (
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-400">{sake.sakeValue}</div>
                      <div className="text-sm text-gray-400">日本酒度</div>
                    </div>
                  )}
                  {sake.acidity && (
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <div className="text-2xl font-bold text-green-400">{sake.acidity}</div>
                      <div className="text-sm text-gray-400">酸度</div>
                    </div>
                  )}
                  {sake.brewery && (
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-400">{sake.brewery}</div>
                      <div className="text-sm text-gray-400">酒蔵</div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Flavor Profile Section */}
        {(flavorProfile || tastingNotes.length > 0) && (
          <motion.div
            className="p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="text-2xl font-semibold mb-6 gradient-text">味わいの特徴</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {flavorProfile && (
                <div className="space-y-6">
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
                          <span className="text-gray-300 font-medium flex items-center gap-2">
                            <span className="text-xl">{getFlavorIcon(flavor.value)}</span>
                            {flavor.label}
                          </span>
                          <span className="text-white font-bold">{(flavor.value as number).toFixed(1)}/5</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full ${flavor.color} rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: `${(((flavor.value as number) ?? 0) / 5) * 100}%` }}
                            transition={{ delay: 0.6 + index * 0.1, duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    ))}
                  {(!flavorProfile.sweetness &&
                    !flavorProfile.lightness &&
                    !flavorProfile.complexity &&
                    !flavorProfile.fruitiness) && (
                      <p className="text-sm text-gray-400">
                        味わいの詳細データは現在取得中です。
                      </p>
                  )}
                </div>
              )}

              {tastingNotes.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xl font-semibold text-white">テイスティングノート</h4>
                  <div className="flex flex-wrap gap-2">
                    {tastingNotes.map((note, index) => (
                      <motion.span
                        key={index}
                        className="px-3 py-1 bg-amber-600/20 text-amber-300 rounded-full text-sm"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7 + index * 0.1 }}
                      >
                        {note}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Serving & Pairing Section */}
        {(servingTemperatures.length > 0 || foodPairing.length > 0) && (
          <motion.div
            className="p-8 pt-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {servingTemperatures.length > 0 && (
                <div>
                  <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Thermometer className="w-5 h-5" />
                    おすすめ飲み方
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {servingTemperatures.map((temp, index) => (
                      <motion.span
                        key={index}
                        className={`px-4 py-2 bg-gray-700/50 rounded-lg font-medium ${getTemperatureColor(temp)}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 + index * 0.1 }}
                      >
                        {temp}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}

              {foodPairing.length > 0 && (
                <div>
                  <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Utensils className="w-5 h-5" />
                    相性の良い料理
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {foodPairing.map((food, index) => (
                      <motion.span
                        key={index}
                        className="px-4 py-2 bg-green-600/20 text-green-300 rounded-lg font-medium"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.0 + index * 0.1 }}
                      >
                        {food}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {offer && (
          <motion.div
            className="p-8 pt-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-500/10 p-5 space-y-3">
              <div className="flex items-center gap-3 text-amber-200">
                <Info className="w-5 h-5" />
                <span className="text-sm uppercase tracking-wider">ソムリエのリサーチ概要</span>
              </div>
              <p className="text-white text-base leading-relaxed whitespace-pre-wrap">{offer.summary}</p>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{offer.reasoning}</p>
              {offer.tastingHighlights && offer.tastingHighlights.length > 0 && (
                <div className="text-sm text-gray-200">
                  <span className="font-semibold text-amber-200 mr-2">ハイライト:</span>
                  {offer.tastingHighlights.join(' / ')}
                </div>
              )}
              {offer.servingSuggestions && offer.servingSuggestions.length > 0 && (
                <div className="text-sm text-gray-200">
                  <span className="font-semibold text-amber-200 mr-2">おすすめの楽しみ方:</span>
                  {offer.servingSuggestions.join(' / ')}
                </div>
              )}
              <div className="text-xs text-gray-400">最終更新: {new Date(offer.updatedAt).toLocaleString()}</div>
              {sake.originSources && sake.originSources.length > 0 && (
                <div className="text-xs text-gray-400 space-y-1">
                  <span className="font-semibold text-gray-300">参考リンク:</span>
                  <ul className="list-disc pl-4 space-y-1">
                    {sake.originSources.map((src) => (
                      <li key={src}>
                        <a href={src} target="_blank" rel="noreferrer" className="text-amber-200 underline">
                          {src}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mb-6 flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-amber-300" />
              <h4 className="text-xl font-semibold text-white">購入候補とリンク</h4>
            </div>

            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {purchaseShops.map((shop) => (
                <motion.a
                  key={`${shop.retailer}-${shop.url}`}
                  href={shop.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-amber-400/20 bg-amber-600/10 p-4 hover:border-amber-300/60 transition-colors"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-amber-200 font-semibold">{shop.retailer}</span>
                    <span className="text-lg font-bold text-white">
                      {shop.price ? formatPrice(shop.price) : shop.priceText ?? '価格を確認'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300 space-y-1">
                    {shop.availability && <p>在庫状況: {shop.availability}</p>}
                    {shop.deliveryEstimate && <p>配送目安: {shop.deliveryEstimate}</p>}
                    {shop.currency && !shop.priceText && (
                      <p>通貨: {shop.currency}</p>
                    )}
                    {shop.source && <p className="text-gray-400">出典: {shop.source}</p>}
                    {shop.notes && <p className="text-gray-400">{shop.notes}</p>}
                  </div>
                </motion.a>
              ))}
              {purchaseShops.length === 0 && (
                <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4 text-sm text-gray-300">
                  信頼できる販売先を確認できませんでした。別の条件でもう一度調査するようリクエストしてみてください。
                </div>
              )}
            </div>

            {offer.alternatives && offer.alternatives.length > 0 && (
              <div className="mb-6 rounded-xl border border-amber-400/10 bg-gray-800/40 p-5">
                <h5 className="text-lg font-semibold text-white mb-4">他の候補</h5>
                <div className="space-y-4">
                  {offer.alternatives.map((alt, index) => (
                    <div
                      key={`${alt.sake.name}-${index}`}
                      className="rounded-lg border border-gray-700/40 bg-gray-900/40 p-4"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <div className="text-amber-200 font-semibold">{alt.sake.name}</div>
                          {alt.sake.brewery && (
                            <div className="text-xs text-gray-400">{alt.sake.brewery}</div>
                          )}
                        </div>
                        {alt.shops[0] && (
                          <a
                            href={alt.shops[0].url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-amber-300 underline"
                          >
                            最安値を見る
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-gray-200 mb-2">{alt.summary}</p>
                      <p className="text-xs text-gray-400 mb-3">{alt.reasoning}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                        {alt.tastingHighlights?.map((note) => (
                          <span key={note} className="px-2 py-1 bg-amber-600/10 rounded-md">
                            {note}
                          </span>
                        ))}
                        {alt.servingSuggestions?.map((note) => (
                          <span key={note} className="px-2 py-1 bg-green-600/10 rounded-md">
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {offer.links && offer.links.length > 0 && (
              <div className="rounded-xl bg-gray-800/60 border border-gray-700/40 p-4">
                <h5 className="text-sm text-gray-300 uppercase tracking-wider mb-2">補足リンク</h5>
                <ul className="space-y-2 text-sm text-gray-200 list-disc pl-5">
                  {offer.links.map((link) => (
                    <li key={link.id}>
                      <a href={link.url} target="_blank" rel="noreferrer" className="text-amber-200 underline">
                        {link.retailer}
                      </a>
                      {link.price && <span className="ml-2 text-gray-300">{formatPrice(link.price)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {offer.followUpPrompt && (
              <div className="rounded-xl border border-dashed border-amber-300/40 bg-amber-500/5 p-4 text-sm text-gray-200">
                💡 {offer.followUpPrompt}
              </div>
            )}
          </motion.div>
        )}

        {/* Call to Action */}
        <motion.div
          className="p-8 pt-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              className="px-8 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-lg shadow-lg transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              この日本酒を詳しく見る
            </motion.button>
            <motion.button
              onClick={onReset}
              className="px-8 py-3 border-2 border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-semibold rounded-lg transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              他の日本酒も見る
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
