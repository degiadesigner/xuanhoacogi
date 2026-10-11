import React from 'react';
import { Food } from '@/lib/foods';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function FoodImage({ 
  food, 
  size = 'md' 
}: { 
  food: Food; 
  size?: 'sm' | 'md' | 'lg' | 'xl' 
}) {
  if (food.customImage) {
    return (
      <div
        role="img"
        aria-label={food.name}
        className={`food-image size-${size}`}
        style={{
          backgroundImage: `url(${basePath}/${food.customImage})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: '#1F2125',
          borderRadius: '50%',
        }}
      />
    );
  }

  if (food.image < 0 || food.image === undefined) {
    const isDrink = food.customId?.startsWith('drink_') || food.name.toLowerCase().includes('trà') || food.name.toLowerCase().includes('cà phê') || food.name.toLowerCase().includes('nước') || food.name.toLowerCase().includes('sinh tố');
    const iconDim = size === 'xl' ? 72 : size === 'lg' ? 52 : size === 'md' ? 36 : 24;

    return (
      <div className={`food-image custom-food-art size-${size}`}>
        {isDrink ? (
          /* Premium Drink Icon */
          <svg viewBox="0 0 24 24" width={iconDim} height={iconDim} fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
            <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
            <line x1="6" y1="2" x2="6" y2="4" />
            <line x1="10" y1="2" x2="10" y2="4" />
            <line x1="14" y1="2" x2="14" y2="4" />
          </svg>
        ) : (
          /* Premium Dining Cloche Icon */
          <svg viewBox="0 0 24 24" width={iconDim} height={iconDim} fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 18h16" />
            <path d="M12 5a8 8 0 0 0-8 8v5h16v-5a8 8 0 0 0-8-8Z" />
            <path d="M12 2v3" />
            <circle cx="12" cy="2" r="1" fill="#D4AF37" />
          </svg>
        )}
      </div>
    );
  }

  const e = food.image;
  let atlas = '';
  let backgroundPosition = '';
  let backgroundSize = '400% 300%';
  let clipPath: string | undefined = undefined;

  if (e >= 600 && e <= 623) {
    let t = (e - 600) % 12;
    atlas = `food-meals-${Math.floor((e - 600) / 12)}`;
    backgroundPosition = `${(t % 4 / 3) * 100}% ${[0, 46, 94][Math.floor(t / 4)]}%`;
  } else if (e >= 500 && e <= 547) {
    let t = (e - 500) % 12, n = Math.floor((e - 500) / 12), a = Math.floor(t / 4), i = [[0, 47, 94], [0, 48, 98], [0, 50, 96], [0, 47, 97]][n];
    atlas = `drink-${2 + n}`;
    clipPath = (0 === a && 0 === n) ? "inset(0 0 2% 0)" : (0 === a && 3 === n) || (1 === a && 0 === n) ? "inset(0 0 7% 0)" : (1 === a && 2 === n) ? "inset(0 0 6% 0)" : undefined;
    backgroundPosition = `${(t % 4 / 3) * 100}% ${i[a]}%`;
  } else if (e >= 400 && e <= 447) {
    let t = (e - 400) % 12, n = Math.floor((e - 400) / 12), a = [[0, 50, 100], [0, 46, 91], [0, 46, 90], [1, 46, 91]][n];
    atlas = `nhau-${n}`;
    backgroundPosition = `${(t % 4 / 3) * 100}% ${a[Math.floor(t / 4)]}%`;
  } else if (e >= 168 && e <= 183) {
    let t = (e - 168) % 4;
    atlas = ["food-chinese-0", "food-korean-0", "food-japanese-0", "food-indian-0"][Math.floor((e - 168) / 4)];
    backgroundSize = "200% 200%";
    backgroundPosition = `${(t % 2) * 100}% ${100 * Math.floor(t / 2)}%`;
  } else if (e >= 300 && e <= 383) {
    let t = (e - 300) % 12, n = Math.floor((e - 300) / 12), a = Math.floor(t / 4), i = [[0, 46, 94], [0, 49, 98.5], [0, 46, 94], [0, 46, 94], [0, 50, 100], [0, 49, 98.5], [0, 46, 94]][n];
    clipPath = (2 === n && 0 === a) ? "inset(0 0 2% 0)" : (3 === n && 0 === a) ? "inset(0 0 6% 0)" : (3 === n && 1 === a) ? "inset(0 0 4% 0)" : (6 === n && 0 === a) ? "inset(0 0 3% 0)" : undefined;
    atlas = `snack-vietnam-${n}`;
    backgroundPosition = `${(t % 4 / 3) * 100}% ${i[a]}%`;
  } else if (e >= 156 && e <= 167) {
    let t = e - 156;
    atlas = "snack-0";
    backgroundPosition = `${(t % 4 / 3) * 100}% ${[0, 47, 93][Math.floor(t / 4)]}%`;
  } else if (e >= 132 && e <= 155) {
    let t = (e - 132) % 12, n = (e < 144 ? [0, 47, 94] : [0, 50, 100])[Math.floor(t / 4)];
    atlas = `drink-${Math.floor((e - 132) / 12)}`;
    backgroundPosition = `${(t % 4 / 3) * 100}% ${n}%`;
  } else {
    const common = e >= 120;
    const lunch = e >= 72 && !common;
    const expanded = e >= 36;
    
    const index = common
      ? (e - 120) % 12
      : lunch
      ? (e - 72) % 12
      : expanded
      ? (e - 36) % 12
      : e % 4;

    atlas = common
      ? `food-common-${Math.floor((e - 120) / 12)}`
      : lunch
      ? `food-lunch-${Math.floor((e - 72) / 12)}`
      : expanded
      ? `food-expanded-${Math.floor((e - 36) / 12)}`
      : `food-hd-${Math.floor(e / 4)}`;

    clipPath = 89 === e ? "inset(0 0 12% 0)" : 93 === e ? undefined : e < 36 && index < 2 || common ? "inset(0 0 4% 0)" : lunch ? "inset(0 0 7% 0)" : undefined;
    backgroundSize = expanded ? "400% 300%" : "200% 200%";
    backgroundPosition = 93 === e ? `${100 / 3}% 89%` : expanded ? `${(index % 4 / 3) * 100}% ${[0, 46, 92][Math.floor(index / 4)]}%` : `${(index % 2) * 100}% ${94 * Math.floor(index / 2)}%`;
  }

  return (
    <div
      role="img"
      aria-label={food.name}
      className={`food-image size-${size}`}
      style={{
        clipPath,
        backgroundImage: `url(${basePath}/${atlas}.webp)`,
        backgroundSize,
        backgroundPosition,
      }}
    />
  );
}
