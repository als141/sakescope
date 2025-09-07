'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Thermometer, Wine, Star, DollarSign, Utensils } from 'lucide-react';
import { SakeData } from '@/data/sakeData';

interface SakeDisplayProps {
  sake: SakeData;
  onReset: () => void;
}

export default function SakeDisplay({ sake, onReset }: SakeDisplayProps) {
  const getFlavorIcon = (value: number) => {
    const icons = ['😐', '🙂', '😊', '😋', '🤤'];
    return icons[Math.max(0, Math.min(4, value - 1))];
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
              className="flex-shrink-0 w-full lg:w-80 h-80 bg-gradient-to-br from-amber-600/20 to-orange-600/20 rounded-xl flex items-center justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="text-center space-y-4">
                <Wine className="w-16 h-16 text-amber-400 mx-auto" />
                <div className="text-2xl font-bold text-amber-400">{sake.name}</div>
                <div className="text-lg text-gray-300">{sake.brewery}</div>
              </div>
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
                    <span>{sake.region}</span>
                  </div>
                  <div className="px-3 py-1 bg-amber-600/20 rounded-full text-amber-400 text-sm font-medium">
                    {sake.type}
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>{sake.price_range}</span>
                  </div>
                </div>
                <p className="text-gray-300 text-lg leading-relaxed">
                  {sake.description}
                </p>
              </motion.div>

              {/* Technical Specs */}
              <motion.div
                className="grid grid-cols-2 lg:grid-cols-4 gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-amber-400">{sake.alcohol}%</div>
                  <div className="text-sm text-gray-400">アルコール度数</div>
                </div>
                <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">{sake.sakeValue}</div>
                  <div className="text-sm text-gray-400">日本酒度</div>
                </div>
                <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">{sake.acidity}</div>
                  <div className="text-sm text-gray-400">酸度</div>
                </div>
                <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">{sake.brewery}</div>
                  <div className="text-sm text-gray-400">酒蔵</div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Flavor Profile Section */}
        <motion.div
          className="p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-2xl font-semibold mb-6 gradient-text">味わいの特徴</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Flavor Bars */}
            <div className="space-y-6">
              {[
                { label: '甘み', value: sake.flavor_profile.sweetness, color: 'bg-pink-500', icon: getFlavorIcon(sake.flavor_profile.sweetness) },
                { label: '軽やかさ', value: sake.flavor_profile.lightness, color: 'bg-blue-500', icon: getFlavorIcon(sake.flavor_profile.lightness) },
                { label: '複雑さ', value: sake.flavor_profile.complexity, color: 'bg-purple-500', icon: getFlavorIcon(sake.flavor_profile.complexity) },
                { label: 'フルーティさ', value: sake.flavor_profile.fruitiness, color: 'bg-green-500', icon: getFlavorIcon(sake.flavor_profile.fruitiness) }
              ].map((flavor, index) => (
                <div key={flavor.label} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium flex items-center gap-2">
                      <span className="text-xl">{flavor.icon}</span>
                      {flavor.label}
                    </span>
                    <span className="text-white font-bold">{flavor.value}/5</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${flavor.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(flavor.value / 5) * 100}%` }}
                      transition={{ delay: 0.6 + index * 0.1, duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Tasting Notes */}
            <div className="space-y-4">
              <h4 className="text-xl font-semibold text-white">テイスティングノート</h4>
              <div className="flex flex-wrap gap-2">
                {sake.tasting_notes.map((note, index) => (
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
          </div>
        </motion.div>

        {/* Serving & Pairing Section */}
        <motion.div
          className="p-8 pt-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Serving Temperature */}
            <div>
              <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Thermometer className="w-5 h-5" />
                おすすめ飲み方
              </h4>
              <div className="flex flex-wrap gap-2">
                {sake.serving_temp.map((temp, index) => (
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

            {/* Food Pairing */}
            <div>
              <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Utensils className="w-5 h-5" />
                相性の良い料理
              </h4>
              <div className="flex flex-wrap gap-2">
                {sake.food_pairing.map((food, index) => (
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
          </div>
        </motion.div>

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