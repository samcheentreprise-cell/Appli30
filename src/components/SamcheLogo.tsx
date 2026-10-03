import React from 'react';

interface SamcheLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  variant?: 'clean' | 'badge' | 'print' | 'symbol';
  showText?: boolean;
  withSubtitle?: boolean;
  subtitleText?: string;
  className?: string;
  onClick?: () => void;
}

export const SamcheLogo: React.FC<SamcheLogoProps> = ({
  size = 'md',
  variant = 'clean',
  showText = true,
  withSubtitle = false,
  subtitleText = "Production de Poussins d'un Jour",
  className = '',
  onClick,
}) => {
  // Dimension definitions
  const sizeMap = {
    xs: { icon: 26, font: 'text-xs', gap: 'gap-1.5' },
    sm: { icon: 34, font: 'text-sm', gap: 'gap-2' },
    md: { icon: 44, font: 'text-base', gap: 'gap-2.5' },
    lg: { icon: 56, font: 'text-lg', gap: 'gap-3' },
    xl: { icon: 72, font: 'text-xl', gap: 'gap-3.5' },
    hero: { icon: 110, font: 'text-3xl', gap: 'gap-4' },
  };

  const currentSize = sizeMap[size];

  // The official vector SVG symbol of SamChe (triquetra with cyan, green, and red interlocking leaves)
  const symbolSvg = (
    <svg
      viewBox="0 0 500 500"
      width={currentSize.icon}
      height={currentSize.icon}
      className="flex-shrink-0 drop-shadow-xs transition-transform duration-200"
    >
      <g transform="translate(250, 240) scale(1.35)">
        {/* Top Cyan Ribbon (0°) */}
        <path
          d="M 0,-140 C 48,-95 82,-35 68,28 C 54,18 38,13 24,10 C 36,-30 16,-82 0,-110 C -16,-82 -36,-30 -24,10 C -38,13 -54,18 -68,28 C -82,-35 -48,-95 0,-140 Z"
          fill="#00AEEF"
        />

        {/* Bottom Left Green Ribbon (120°) */}
        <g transform="rotate(120)">
          <path
            d="M 0,-140 C 48,-95 82,-35 68,28 C 54,18 38,13 24,10 C 36,-30 16,-82 0,-110 C -16,-82 -36,-30 -24,10 C -38,13 -54,18 -68,28 C -82,-35 -48,-95 0,-140 Z"
            fill="#00D000"
          />
        </g>

        {/* Bottom Right Red Ribbon (240°) */}
        <g transform="rotate(240)">
          <path
            d="M 0,-140 C 48,-95 82,-35 68,28 C 54,18 38,13 24,10 C 36,-30 16,-82 0,-110 C -16,-82 -36,-30 -24,10 C -38,13 -54,18 -68,28 C -82,-35 -48,-95 0,-140 Z"
            fill="#FF0000"
          />
        </g>

        {/* Weaving Overlays for Authentic Interlocked Triquetra Knot */}
        <path
          d="M 12,-98 C 24,-72 34,-42 36,-14 C 26,-12 16,-9 6,-4 C 5,-28 8,-62 12,-98 Z"
          fill="#00AEEF"
        />
        <g transform="rotate(120)">
          <path
            d="M 12,-98 C 24,-72 34,-42 36,-14 C 26,-12 16,-9 6,-4 C 5,-28 8,-62 12,-98 Z"
            fill="#00D000"
          />
        </g>
        <g transform="rotate(240)">
          <path
            d="M 12,-98 C 24,-72 34,-42 36,-14 C 26,-12 16,-9 6,-4 C 5,-28 8,-62 12,-98 Z"
            fill="#FF0000"
          />
        </g>
      </g>
    </svg>
  );

  if (variant === 'symbol') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`} onClick={onClick}>
        {symbolSvg}
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center ${currentSize.gap} bg-white px-3 py-1.5 rounded-2xl shadow-sm border border-slate-200/90 transition hover:shadow-md ${className}`}
        onClick={onClick}
      >
        {symbolSvg}
        {showText && (
          <div className="flex flex-col text-left">
            <span
              className={`font-black tracking-tight text-slate-900 leading-tight font-serif ${currentSize.font}`}
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              SamChe
            </span>
            {withSubtitle && (
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {subtitleText}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Document & Print Variant (crisp, high contrast for A4 printable invoices & delivery slips)
  if (variant === 'print') {
    return (
      <div
        className={`flex items-center ${currentSize.gap} ${className}`}
        onClick={onClick}
      >
        <div className="p-1 rounded-xl bg-white border border-slate-200 shadow-2xs flex-shrink-0">
          <img
            src="/logo-samche.png"
            alt="Logo SamChe"
            width={currentSize.icon}
            height={currentSize.icon}
            className="object-contain"
            onError={(e) => {
              // Fallback to SVG if image not found
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>
        {showText && (
          <div className="flex flex-col text-left">
            <span
              className="font-black text-slate-900 tracking-tight leading-none text-2xl font-serif"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              SamChe
            </span>
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest mt-1">
              Couvoir &amp; Aviculture Moderne
            </span>
            {withSubtitle && (
              <span className="text-[10px] text-slate-500">
                {subtitleText}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Clean Variant
  return (
    <div
      className={`inline-flex items-center ${currentSize.gap} ${className}`}
      onClick={onClick}
    >
      {symbolSvg}
      {showText && (
        <div className="flex flex-col text-left">
          <span
            className={`font-black text-inherit tracking-tight leading-tight font-serif ${currentSize.font}`}
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            SamChe
          </span>
          {withSubtitle && (
            <span className="text-[10px] opacity-80 font-medium tracking-wide">
              {subtitleText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
