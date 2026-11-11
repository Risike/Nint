import type { Language } from './translations';

type ShopLabels = Record<Language, string>;

const PIECE_SKIN_LABELS: Record<string, ShopLabels> = {
  classic: { en: 'Classic', fr: 'Classique', de: 'Klassisch', es: 'Clásico', it: 'Classico' },
  neon: { en: 'Neon', fr: 'Néon', de: 'Neon', es: 'Neón', it: 'Neon' },
  glass: { en: 'Glass', fr: 'Verre', de: 'Glas', es: 'Cristal', it: 'Vetro' },
  pixel: { en: 'Pixel', fr: 'Pixel', de: 'Pixel', es: 'Píxel', it: 'Pixel' },
  candy: { en: 'Candy', fr: 'Bonbon', de: 'Bonbon', es: 'Caramelo', it: 'Caramella' },
  retro: { en: 'Retro', fr: 'Rétro', de: 'Retro', es: 'Retro', it: 'Retrò' },
  metallic: { en: 'Metallic', fr: 'Métallique', de: 'Metallisch', es: 'Metálico', it: 'Metallico' },
  holographic: { en: 'Holographic', fr: 'Holographique', de: 'Holografisch', es: 'Holográfico', it: 'Olografico' },
  mosaic: { en: 'Mosaic', fr: 'Mosaïque', de: 'Mosaik', es: 'Mosaico', it: 'Mosaico' },
  circuit: { en: 'Circuit', fr: 'Circuit', de: 'Schaltkreis', es: 'Circuito', it: 'Circuito' },
  gradient: { en: 'Gradient', fr: 'Dégradé', de: 'Verlauf', es: 'Degradado', it: 'Sfumato' },
  checker: { en: 'Checker', fr: 'Damier', de: 'Schachbrett', es: 'Damero', it: 'Scacchiera' },
  striped: { en: 'Striped', fr: 'Rayé', de: 'Gestreift', es: 'Rayado', it: 'A righe' },
  glossy: { en: 'Glossy', fr: 'Lustré', de: 'Glänzend', es: 'Brillante', it: 'Lucido' },
  matte: { en: 'Matte', fr: 'Mat', de: 'Matt', es: 'Mate', it: 'Opaco' },
  gem: { en: 'Gem', fr: 'Gemme', de: 'Edelstein', es: 'Gema', it: 'Gemma' },
  wood: { en: 'Wood', fr: 'Bois', de: 'Holz', es: 'Madera', it: 'Legno' },
  marble: { en: 'Marble', fr: 'Marbre', de: 'Marmor', es: 'Mármol', it: 'Marmo' },
  carbon: { en: 'Carbon', fr: 'Carbone', de: 'Kohlenstoff', es: 'Carbono', it: 'Carbonio' },
  ice: { en: 'Ice', fr: 'Glace', de: 'Eis', es: 'Hielo', it: 'Ghiaccio' }
};

const NAME_COLOR_LABELS: Record<string, ShopLabels> = {
  default: { en: 'White', fr: 'Blanc', de: 'Weiß', es: 'Blanco', it: 'Bianco' },
  cyan: { en: 'Cyan', fr: 'Cyan', de: 'Cyan', es: 'Cian', it: 'Ciano' },
  pink: { en: 'Pink', fr: 'Rose', de: 'Rosa', es: 'Rosa', it: 'Rosa' },
  gold: { en: 'Gold', fr: 'Or', de: 'Gold', es: 'Dorado', it: 'Oro' },
  green: { en: 'Green', fr: 'Vert', de: 'Grün', es: 'Verde', it: 'Verde' },
  red: { en: 'Red', fr: 'Rouge', de: 'Rot', es: 'Rojo', it: 'Rosso' },
  orange: { en: 'Orange', fr: 'Orange', de: 'Orange', es: 'Naranja', it: 'Arancione' },
  yellow: { en: 'Yellow', fr: 'Jaune', de: 'Gelb', es: 'Amarillo', it: 'Giallo' },
  lime: { en: 'Lime', fr: 'Citron vert', de: 'Limette', es: 'Lima', it: 'Lime' },
  emerald: { en: 'Emerald', fr: 'Émeraude', de: 'Smaragd', es: 'Esmeralda', it: 'Smeraldo' },
  teal: { en: 'Teal', fr: 'Bleu canard', de: 'Petrol', es: 'Verde azulado', it: 'Verde acqua' },
  sky: { en: 'Sky', fr: 'Bleu ciel', de: 'Himmelblau', es: 'Azul cielo', it: 'Azzurro cielo' },
  blue: { en: 'Blue', fr: 'Bleu', de: 'Blau', es: 'Azul', it: 'Blu' },
  indigo: { en: 'Indigo', fr: 'Indigo', de: 'Indigo', es: 'Índigo', it: 'Indaco' },
  violet: { en: 'Violet', fr: 'Violet', de: 'Violett', es: 'Violeta', it: 'Viola' },
  purple: { en: 'Purple', fr: 'Pourpre', de: 'Purpur', es: 'Púrpura', it: 'Porpora' },
  fuchsia: { en: 'Fuchsia', fr: 'Fuchsia', de: 'Fuchsia', es: 'Fucsia', it: 'Fucsia' },
  rose: { en: 'Rose', fr: 'Rose', de: 'Rosé', es: 'Rosa', it: 'Rosa' },
  silver: { en: 'Silver', fr: 'Argent', de: 'Silber', es: 'Plateado', it: 'Argento' },
  lava: { en: 'Lava', fr: 'Lave', de: 'Lava', es: 'Lava', it: 'Lava' }
};

const NAME_DECORATION_LABELS: Record<string, ShopLabels> = {
  none: { en: 'None', fr: 'Aucune', de: 'Keine', es: 'Ninguna', it: 'Nessuna' },
  glow: { en: 'Glow', fr: 'Lueur', de: 'Leuchten', es: 'Brillo', it: 'Bagliore' },
  underline: { en: 'Underline', fr: 'Soulignement', de: 'Unterstreichen', es: 'Subrayado', it: 'Sottolineato' },
  brackets: { en: 'Brackets', fr: 'Chevrons', de: 'Klammern', es: 'Corchetes angulares', it: 'Parentesi angolari' },
  sparkle: { en: 'Sparkle', fr: 'Étincelle', de: 'Funkeln', es: 'Destello', it: 'Scintilla' },
  double_underline: { en: 'Double Underline', fr: 'Double soulignement', de: 'Doppelunterstreichung', es: 'Doble subrayado', it: 'Doppia sottolineatura' },
  overline: { en: 'Overline', fr: 'Ligne supérieure', de: 'Überstreichen', es: 'Línea superior', it: 'Linea superiore' },
  shadow: { en: 'Shadow', fr: 'Ombre', de: 'Schatten', es: 'Sombra', it: 'Ombra' },
  outline: { en: 'Outline', fr: 'Contour', de: 'Kontur', es: 'Contorno', it: 'Contorno' },
  pill: { en: 'Pill', fr: 'Badge arrondi', de: 'Pille', es: 'Insignia', it: 'Badge arrotondato' },
  box: { en: 'Box', fr: 'Cadre', de: 'Rahmen', es: 'Caja', it: 'Riquadro' },
  dots: { en: 'Dotted', fr: 'Pointillé', de: 'Gepunktet', es: 'Punteado', it: 'Punteggiato' },
  wave: { en: 'Wave', fr: 'Vague', de: 'Welle', es: 'Onda', it: 'Onda' },
  angles: { en: 'Angles', fr: 'Angles', de: 'Winkel', es: 'Ángulos', it: 'Angoli' },
  stars: { en: 'Stars', fr: 'Étoiles', de: 'Sterne', es: 'Estrellas', it: 'Stelle' },
  diamonds: { en: 'Diamonds', fr: 'Diamants', de: 'Diamanten', es: 'Diamantes', it: 'Diamanti' },
  arrows: { en: 'Arrows', fr: 'Flèches', de: 'Pfeile', es: 'Flechas', it: 'Frecce' },
  brackets_square: { en: 'Square Brackets', fr: 'Crochets', de: 'Eckige Klammern', es: 'Corchetes', it: 'Parentesi quadre' },
  parentheses: { en: 'Parentheses', fr: 'Parenthèses', de: 'Klammern', es: 'Paréntesis', it: 'Parentesi' },
  highlight: { en: 'Highlight', fr: 'Surlignage', de: 'Hervorhebung', es: 'Resaltado', it: 'Evidenziazione' }
};

const SHOP_ITEM_LABELS: Record<string, ShopLabels> = {
  ...Object.fromEntries(Object.entries(PIECE_SKIN_LABELS).map(([value, labels]) => [`piece_${value}`, labels])),
  ...Object.fromEntries(Object.entries(NAME_COLOR_LABELS).map(([value, labels]) => [`color_${value}`, labels])),
  ...Object.fromEntries(Object.entries(NAME_DECORATION_LABELS).map(([value, labels]) => [`decor_${value}`, labels]))
};
SHOP_ITEM_LABELS.decor_square_brackets = NAME_DECORATION_LABELS.brackets_square;

export function getShopItemLabel(itemId: string, fallback: string, language: Language): string {
  return SHOP_ITEM_LABELS[itemId]?.[language] || fallback;
}

export function getPieceSkinLabel(value: string, language: Language): string {
  return PIECE_SKIN_LABELS[value]?.[language] || value;
}

export function getNameDecorationLabel(value: string, language: Language): string {
  return NAME_DECORATION_LABELS[value]?.[language] || value;
}
