import type { Language } from './translations';
import { FIXED_COLOR_LABELS, GRADIENT_COLOR_LABELS } from './nameColors';

type ShopLabels = Record<Language, string>;

const labels = (en: string, fr: string, de: string, es: string, it: string): ShopLabels => ({
  en, fr, de, es, it
});

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
  ice: { en: 'Ice', fr: 'Glace', de: 'Eis', es: 'Hielo', it: 'Ghiaccio' },
  round_classic: { en: 'Round Classic', fr: 'Classique rond', de: 'Rund klassisch', es: 'Clásico redondo', it: 'Classico rotondo' },
  round_neon: { en: 'Neon Orb', fr: 'Orbe néon', de: 'Neon-Kugel', es: 'Orbe neón', it: 'Sfera neon' },
  round_glass: { en: 'Glass Bubble', fr: 'Bulle de verre', de: 'Glaskugel', es: 'Burbuja de cristal', it: 'Bolla di vetro' },
  round_candy: { en: 'Candy Drop', fr: 'Bonbon rond', de: 'Bonbon-Tropfen', es: 'Gota de caramelo', it: 'Goccia di caramella' },
  round_metallic: { en: 'Metal Sphere', fr: 'Sphère métallique', de: 'Metallkugel', es: 'Esfera metálica', it: 'Sfera metallica' },
  round_gem: { en: 'Gemstone', fr: 'Gemme ronde', de: 'Edelstein-Kugel', es: 'Gema redonda', it: 'Gemma rotonda' },
  round_glow: { en: 'Glow Ball', fr: 'Boule lumineuse', de: 'Leuchtkugel', es: 'Bola brillante', it: 'Sfera luminosa' },
  round_marble: { en: 'Marble Orb', fr: 'Orbe de marbre', de: 'Marmorkugel', es: 'Orbe de mármol', it: 'Sfera di marmo' },
  round_ice: { en: 'Ice Sphere', fr: 'Sphère de glace', de: 'Eiskugel', es: 'Esfera de hielo', it: 'Sfera di ghiaccio' },
  round_wood: { en: 'Wooden Ball', fr: 'Boule en bois', de: 'Holzkugel', es: 'Bola de madera', it: 'Sfera di legno' },
  round_holographic: { en: 'Holo Orb', fr: 'Orbe holographique', de: 'Holo-Kugel', es: 'Orbe holográfico', it: 'Sfera olografica' },
  round_striped: { en: 'Striped Sphere', fr: 'Sphère rayée', de: 'Gestreifte Kugel', es: 'Esfera rayada', it: 'Sfera a righe' },
  round_checker: { en: 'Checker Ball', fr: 'Boule damier', de: 'Schachbrettkugel', es: 'Bola de damero', it: 'Sfera a scacchiera' },
  round_mosaic: { en: 'Mosaic Orb', fr: 'Orbe mosaïque', de: 'Mosaikkugel', es: 'Orbe de mosaico', it: 'Sfera a mosaico' },
  round_carbon: { en: 'Carbon Sphere', fr: 'Sphère carbone', de: 'Kohlenstoffkugel', es: 'Esfera de carbono', it: 'Sfera di carbonio' },
  round_gradient: { en: 'Gradient Orb', fr: 'Orbe dégradé', de: 'Verlaufskugel', es: 'Orbe degradado', it: 'Sfera sfumata' },
  round_glossy: { en: 'Glossy Ball', fr: 'Boule lustrée', de: 'Glanzkugel', es: 'Bola brillante', it: 'Sfera lucida' },
  round_matte: { en: 'Matte Sphere', fr: 'Sphère mate', de: 'Matte Kugel', es: 'Esfera mate', it: 'Sfera opaca' },
  round_pearl: { en: 'Pearl', fr: 'Perle', de: 'Perle', es: 'Perla', it: 'Perla' },
  round_planet: { en: 'Planet', fr: 'Planète', de: 'Planet', es: 'Planeta', it: 'Pianeta' }
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
  highlight: { en: 'Highlight', fr: 'Surlignage', de: 'Hervorhebung', es: 'Resaltado', it: 'Evidenziazione' },
  quotes: labels('Quotes', 'Guillemets anglais', 'Anführungszeichen', 'Comillas', 'Virgolette'),
  guillemets: labels('Guillemets', 'Guillemets français', 'Spitzklammern', 'Comillas francesas', 'Virgolette francesi'),
  corner: labels('Corners', 'Coins', 'Ecken', 'Esquinas', 'Angoli'),
  corner_double: labels('Double Corners', 'Doubles coins', 'Doppelte Ecken', 'Dobles esquinas', 'Doppi angoli'),
  braces: labels('Braces', 'Accolades', 'Geschweifte Klammern', 'Llaves', 'Graffe'),
  chevrons_double: labels('Double Chevrons', 'Doubles chevrons', 'Doppelspitzen', 'Dobles chevrones', 'Doppi chevron'),
  tildes: labels('Tildes', 'Tildes', 'Tilden', 'Tildes', 'Tilde'),
  pipes: labels('Pipes', 'Barres', 'Senkrechte Striche', 'Barras', 'Barre'),
  slashes: labels('Slashes', 'Barres obliques', 'Schrägstriche', 'Barras inclinadas', 'Barre oblique'),
  plus_signs: labels('Plus Signs', 'Signes plus', 'Pluszeichen', 'Signos más', 'Segni più'),
  equals: labels('Equals', 'Signes égal', 'Gleichheitszeichen', 'Iguales', 'Uguali'),
  hashes: labels('Hashes', 'Dièses', 'Rauten', 'Almohadillas', 'Cancelletto'),
  at_sign: labels('At Signs', 'Arobases', 'At-Zeichen', 'Arrobas', 'Chiocciole'),
  music: labels('Music', 'Musique', 'Musik', 'Música', 'Musica'),
  hearts: labels('Hearts', 'Cœurs', 'Herzen', 'Corazones', 'Cuori'),
  lightning: labels('Lightning', 'Éclairs', 'Blitze', 'Rayos', 'Fulmini'),
  flames: labels('Flames', 'Flammes', 'Flammen', 'Llamas', 'Fiamme'),
  flowers: labels('Flowers', 'Fleurs', 'Blumen', 'Flores', 'Fiori'),
  moons: labels('Moons', 'Lunes', 'Monde', 'Lunas', 'Lune'),
  crystals: labels('Crystals', 'Cristaux', 'Kristalle', 'Cristales', 'Cristalli'),
  target: labels('Targets', 'Cibles', 'Ziele', 'Dianas', 'Bersagli'),
  crowns: labels('Crowns', 'Couronnes', 'Kronen', 'Coronas', 'Corone'),
  wings: labels('Wings', 'Ailes', 'Flügel', 'Alas', 'Ali'),
  ribbon: labels('Ribbon', 'Ruban', 'Schleife', 'Cinta', 'Nastro'),
  gold_frame: labels('Gold Frame', 'Cadre doré', 'Goldrahmen', 'Marco dorado', 'Cornice dorata'),
  emboss: labels('Emboss', 'Relief', 'Geprägt', 'Relieve', 'Rilievo'),
  glitch: labels('Glitch', 'Glitch', 'Glitch', 'Glitch', 'Glitch'),
  dashed_line: labels('Dashed Line', 'Ligne pointillée', 'Gestrichelte Linie', 'Línea discontinua', 'Linea tratteggiata'),
  orbit: labels('Orbit', 'Orbite', 'Orbit', 'Órbita', 'Orbita'),
  terminal: labels('Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal')
};

const SHOP_ITEM_LABELS: Record<string, ShopLabels> = {
  ...Object.fromEntries(Object.entries(PIECE_SKIN_LABELS).map(([value, labels]) => [`piece_${value}`, labels])),
  ...Object.fromEntries(Object.entries(FIXED_COLOR_LABELS).map(([value, labels]) => [`color_${value}`, labels])),
  ...Object.fromEntries(Object.entries(GRADIENT_COLOR_LABELS).map(([value, labels]) => [`color_${value}`, labels])),
  ...Object.fromEntries(Object.entries(NAME_DECORATION_LABELS).map(([value, labels]) => [`decor_${value}`, labels]))
};
SHOP_ITEM_LABELS.decor_square_brackets = NAME_DECORATION_LABELS.brackets_square;
SHOP_ITEM_LABELS.decor_gradient_fill = NAME_DECORATION_LABELS.gold_frame;

export interface LocalizedShopItem {
  id: string;
  kind: string;
  name: string;
  value?: string;
  is_default?: number | boolean;
  name_fr?: string | null;
  name_de?: string | null;
  name_es?: string | null;
  name_it?: string | null;
}

export function getShopItemLabel(itemId: string, fallback: string, language: Language): string {
  return SHOP_ITEM_LABELS[itemId]?.[language] || fallback;
}

export function getShopItemDisplayName(item: LocalizedShopItem, language: Language): string {
  const englishName = String(item.name || '').trim();
  if (language === 'en') return englishName;
  const localizedName = String(item[`name_${language}` as keyof LocalizedShopItem] || '').trim();
  return localizedName || englishName;
}

export function getPieceSkinLabel(value: string, language: Language): string {
  return PIECE_SKIN_LABELS[value]?.[language] || value;
}

export function getNameDecorationLabel(value: string, language: Language): string {
  return NAME_DECORATION_LABELS[value]?.[language] || value;
}
