import type { Language } from './translations';

export interface ThemePreview {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgCard: string;
  borderColor: string;
  borderFocus: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentCyan: string;
  accentBlue: string;
  accentPurple: string;
  accentPink: string;
  accentGreen: string;
  accentOrange: string;
  accentRed: string;
  accentYellow: string;
  shadow: string;
}

export interface ThemeCatalogEntry {
  value: string;
  mode: 'dark' | 'light';
  labels: Record<Language, string>;
  preview: ThemePreview;
}

export const THEME_CATALOG: Record<string, ThemeCatalogEntry> = {
  "dark-01": {
    "value": "dark-01",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Minuit",
      "de": "Dunkel — Mitternacht",
      "es": "Oscuro — Medianoche",
      "it": "Scuro — Mezzanotte",
      "en": "Dark — Midnight"
    },
    "preview": {
      "bgPrimary": "#0b0d19",
      "bgSecondary": "#11142a",
      "bgTertiary": "#171c3b",
      "bgCard": "rgba(17, 20, 42, 0.88)",
      "borderColor": "rgba(116, 174, 241, 0.24)",
      "borderFocus": "#74aef1",
      "textPrimary": "#f6f6f9",
      "textSecondary": "#cccfe0",
      "textMuted": "#989ec3",
      "accentCyan": "#74f1f1",
      "accentBlue": "#74aef1",
      "accentPurple": "#b374f1",
      "accentPink": "#f174bf",
      "accentGreen": "#74f1a2",
      "accentOrange": "#f19974",
      "accentRed": "#f17489",
      "accentYellow": "#f6c96f",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-02": {
    "value": "dark-02",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Océan",
      "de": "Dunkel — Ozean",
      "es": "Oscuro — Océano",
      "it": "Scuro — Oceano",
      "en": "Dark — Ocean"
    },
    "preview": {
      "bgPrimary": "#04172f",
      "bgSecondary": "#042146",
      "bgTertiary": "#042e62",
      "bgCard": "rgba(4, 33, 70, 0.9)",
      "borderColor": "rgba(126, 157, 241, 0.28)",
      "borderFocus": "#7e9df1",
      "textPrimary": "#f6f7f9",
      "textSecondary": "#ccd6e0",
      "textMuted": "#98adc3",
      "accentCyan": "#75d7f0",
      "accentBlue": "#7e9df1",
      "accentPurple": "#ce7ef1",
      "accentPink": "#f077a7",
      "accentGreen": "#75f0bb",
      "accentOrange": "#f0b375",
      "accentRed": "#f17d7a",
      "accentYellow": "#f4e371",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-03": {
    "value": "dark-03",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Forêt",
      "de": "Dunkel — Wald",
      "es": "Oscuro — Bosque",
      "it": "Scuro — Foresta",
      "en": "Dark — Forest"
    },
    "preview": {
      "bgPrimary": "#05190a",
      "bgSecondary": "#082d11",
      "bgTertiary": "#0a4719",
      "bgCard": "rgba(8, 45, 17, 0.9)",
      "borderColor": "rgba(123, 201, 234, 0.28)",
      "borderFocus": "#7bc9ea",
      "textPrimary": "#f6f9f7",
      "textSecondary": "#cce0d1",
      "textMuted": "#98c3a3",
      "accentCyan": "#7bead0",
      "accentBlue": "#7bc9ea",
      "accentPurple": "#b49fef",
      "accentPink": "#ec89db",
      "accentGreen": "#7bea8a",
      "accentOrange": "#ec938d",
      "accentRed": "#ec8db3",
      "accentYellow": "#eeab77",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-04": {
    "value": "dark-04",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Braise",
      "de": "Dunkel — Glut",
      "es": "Oscuro — Brasa",
      "it": "Scuro — Brace",
      "en": "Dark — Ember"
    },
    "preview": {
      "bgPrimary": "#260c05",
      "bgSecondary": "#3c1107",
      "bgTertiary": "#561808",
      "bgCard": "rgba(60, 17, 7, 0.9)",
      "borderColor": "rgba(128, 144, 250, 0.28)",
      "borderFocus": "#8090fa",
      "textPrimary": "#f9f7f6",
      "textSecondary": "#e0d0cc",
      "textMuted": "#c3a198",
      "accentCyan": "#62c6f8",
      "accentBlue": "#8090fa",
      "accentPurple": "#df62f8",
      "accentPink": "#f8628a",
      "accentGreen": "#62f8cb",
      "accentOrange": "#f8c162",
      "accentRed": "#f87b62",
      "accentYellow": "#fdfd5d",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-05": {
    "value": "dark-05",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Améthyste",
      "de": "Dunkel — Amethyst",
      "es": "Oscuro — Amatista",
      "it": "Scuro — Ametista",
      "en": "Dark — Amethyst"
    },
    "preview": {
      "bgPrimary": "#160a32",
      "bgSecondary": "#1e0c47",
      "bgTertiary": "#270e61",
      "bgCard": "rgba(30, 12, 71, 0.9)",
      "borderColor": "rgba(125, 129, 242, 0.28)",
      "borderFocus": "#7d81f2",
      "textPrimary": "#f8f6f9",
      "textSecondary": "#d9cce0",
      "textMuted": "#b498c3",
      "accentCyan": "#7dbff2",
      "accentBlue": "#7d81f2",
      "accentPurple": "#ea7df2",
      "accentPink": "#f27d91",
      "accentGreen": "#7df2db",
      "accentOrange": "#f2d37d",
      "accentRed": "#f29c7d",
      "accentYellow": "#eaf679",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-06": {
    "value": "dark-06",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Bois de rose",
      "de": "Dunkel — Rosenholz",
      "es": "Oscuro — Palo de rosa",
      "it": "Scuro — Legno di rosa",
      "en": "Dark — Rosewood"
    },
    "preview": {
      "bgPrimary": "#221114",
      "bgSecondary": "#34161b",
      "bgTertiary": "#491d24",
      "bgCard": "rgba(52, 22, 27, 0.9)",
      "borderColor": "rgba(134, 175, 228, 0.28)",
      "borderFocus": "#86afe4",
      "textPrimary": "#f9f6f6",
      "textSecondary": "#e0ccd0",
      "textMuted": "#c3989f",
      "accentCyan": "#86e1e4",
      "accentBlue": "#86afe4",
      "accentPurple": "#b886e4",
      "accentPink": "#e486bb",
      "accentGreen": "#86e4ac",
      "accentOrange": "#e4a586",
      "accentRed": "#e48692",
      "accentYellow": "#e9ca81",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-07": {
    "value": "dark-07",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Cobalt",
      "de": "Dunkel — Kobalt",
      "es": "Oscuro — Cobalto",
      "it": "Scuro — Cobalto",
      "en": "Dark — Cobalt"
    },
    "preview": {
      "bgPrimary": "#041c42",
      "bgSecondary": "#03255a",
      "bgTertiary": "#022f77",
      "bgCard": "rgba(3, 37, 90, 0.9)",
      "borderColor": "rgba(108, 160, 249, 0.28)",
      "borderFocus": "#6ca0f9",
      "textPrimary": "#f6f7f9",
      "textSecondary": "#ccd5e0",
      "textMuted": "#98aac3",
      "accentCyan": "#6cebf9",
      "accentBlue": "#6ca0f9",
      "accentPurple": "#c87dfa",
      "accentPink": "#f96cb3",
      "accentGreen": "#6cf9ae",
      "accentOrange": "#f9a46c",
      "accentRed": "#f9737d",
      "accentYellow": "#fdda68",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-08": {
    "value": "dark-08",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Bleu canard",
      "de": "Dunkel — Petrol",
      "es": "Oscuro — Verde azulado",
      "it": "Scuro — Verde acqua",
      "en": "Dark — Teal"
    },
    "preview": {
      "bgPrimary": "#03282a",
      "bgSecondary": "#033e41",
      "bgTertiary": "#03595d",
      "bgCard": "rgba(3, 62, 65, 0.9)",
      "borderColor": "rgba(181, 195, 245, 0.28)",
      "borderFocus": "#b5c3f5",
      "textPrimary": "#f6f9f9",
      "textSecondary": "#cce0df",
      "textMuted": "#a5cbc9",
      "accentCyan": "#7dd3ed",
      "accentBlue": "#b5c3f5",
      "accentPurple": "#e3b3f5",
      "accentPink": "#f4b1ca",
      "accentGreen": "#7dedc0",
      "accentOrange": "#edba7f",
      "accentRed": "#f4b5b1",
      "accentYellow": "#f2e678",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-09": {
    "value": "dark-09",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Olive",
      "de": "Dunkel — Olive",
      "es": "Oscuro — Oliva",
      "it": "Scuro — Oliva",
      "en": "Dark — Olive"
    },
    "preview": {
      "bgPrimary": "#1f240a",
      "bgSecondary": "#30370e",
      "bgTertiary": "#454f12",
      "bgCard": "rgba(48, 55, 14, 0.9)",
      "borderColor": "rgba(142, 204, 225, 0.28)",
      "borderFocus": "#8ecce1",
      "textPrimary": "#f8f9f6",
      "textSecondary": "#dde0cc",
      "textMuted": "#bcc398",
      "accentCyan": "#8ee1ca",
      "accentBlue": "#8ecce1",
      "accentPurple": "#c2b6ec",
      "accentPink": "#e9aae1",
      "accentGreen": "#8ee195",
      "accentOrange": "#eaafae",
      "accentRed": "#e9aac6",
      "accentYellow": "#e6b08e",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-10": {
    "value": "dark-10",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Sable",
      "de": "Dunkel — Sand",
      "es": "Oscuro — Arena",
      "it": "Scuro — Sabbia",
      "en": "Dark — Sand"
    },
    "preview": {
      "bgPrimary": "#33270f",
      "bgSecondary": "#473612",
      "bgTertiary": "#604716",
      "bgCard": "rgba(71, 54, 18, 0.9)",
      "borderColor": "rgba(183, 185, 235, 0.28)",
      "borderFocus": "#b7b9eb",
      "textPrimary": "#f9f8f6",
      "textSecondary": "#e0d9cc",
      "textMuted": "#cabea5",
      "accentCyan": "#98c2e2",
      "accentBlue": "#b7b9eb",
      "accentPurple": "#e3abe7",
      "accentPink": "#e9afb9",
      "accentGreen": "#98e2d3",
      "accentOrange": "#e2ce98",
      "accentRed": "#e4b2a0",
      "accentYellow": "#dee694",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-11": {
    "value": "dark-11",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Prune",
      "de": "Dunkel — Pflaume",
      "es": "Oscuro — Ciruela",
      "it": "Scuro — Prugna",
      "en": "Dark — Plum"
    },
    "preview": {
      "bgPrimary": "#26081d",
      "bgSecondary": "#3b0a2c",
      "bgTertiary": "#540d3f",
      "bgCard": "rgba(59, 10, 44, 0.9)",
      "borderColor": "rgba(140, 137, 246, 0.28)",
      "borderFocus": "#8c89f6",
      "textPrimary": "#f9f6f8",
      "textSecondary": "#e0ccdd",
      "textMuted": "#c398bc",
      "accentCyan": "#71b3f4",
      "accentBlue": "#8c89f6",
      "accentPurple": "#f471f4",
      "accentPink": "#f4717e",
      "accentGreen": "#71f4e3",
      "accentOrange": "#f4da71",
      "accentRed": "#f49d71",
      "accentYellow": "#e1f96c",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-12": {
    "value": "dark-12",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Acier",
      "de": "Dunkel — Stahl",
      "es": "Oscuro — Acero",
      "it": "Scuro — Acciaio",
      "en": "Dark — Steel"
    },
    "preview": {
      "bgPrimary": "#141c24",
      "bgSecondary": "#1a2835",
      "bgTertiary": "#21364a",
      "bgCard": "rgba(26, 40, 53, 0.9)",
      "borderColor": "rgba(155, 189, 212, 0.28)",
      "borderFocus": "#9bbdd4",
      "textPrimary": "#f6f7f9",
      "textSecondary": "#ccd6e0",
      "textMuted": "#98adc3",
      "accentCyan": "#9bd4cd",
      "accentBlue": "#9bbdd4",
      "accentPurple": "#b09bd4",
      "accentPink": "#d49bc5",
      "accentGreen": "#9bd4a8",
      "accentOrange": "#d4a59b",
      "accentRed": "#d49bac",
      "accentYellow": "#d8ba97",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-13": {
    "value": "dark-13",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Cuivre",
      "de": "Dunkel — Kupfer",
      "es": "Oscuro — Cobre",
      "it": "Scuro — Rame",
      "en": "Dark — Copper"
    },
    "preview": {
      "bgPrimary": "#2c1908",
      "bgSecondary": "#41240a",
      "bgTertiary": "#5b310c",
      "bgCard": "rgba(65, 36, 10, 0.9)",
      "borderColor": "rgba(151, 163, 233, 0.28)",
      "borderFocus": "#97a3e9",
      "textPrimary": "#f9f7f6",
      "textSecondary": "#e0d5cc",
      "textMuted": "#c3aa98",
      "accentCyan": "#84c5e6",
      "accentBlue": "#97a3e9",
      "accentPurple": "#d88ae7",
      "accentPink": "#e88ca5",
      "accentGreen": "#84e6c9",
      "accentOrange": "#e6c284",
      "accentRed": "#e69584",
      "accentYellow": "#eaea80",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-14": {
    "value": "dark-14",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Jade",
      "de": "Dunkel — Jade",
      "es": "Oscuro — Jade",
      "it": "Scuro — Giada",
      "en": "Dark — Jade"
    },
    "preview": {
      "bgPrimary": "#0a2e14",
      "bgSecondary": "#0c431b",
      "bgTertiary": "#0f5c24",
      "bgCard": "rgba(12, 67, 27, 0.9)",
      "borderColor": "rgba(146, 202, 238, 0.28)",
      "borderFocus": "#92caee",
      "textPrimary": "#f6f9f7",
      "textSecondary": "#cce0d5",
      "textMuted": "#a8ccb7",
      "accentCyan": "#7aebdc",
      "accentBlue": "#92caee",
      "accentPurple": "#d0baf4",
      "accentPink": "#f3afe1",
      "accentGreen": "#7aeb94",
      "accentOrange": "#f2b5a8",
      "accentRed": "#f3b1c6",
      "accentYellow": "#f1b97a",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-15": {
    "value": "dark-15",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Galaxie",
      "de": "Dunkel — Galaxie",
      "es": "Oscuro — Galaxia",
      "it": "Scuro — Galassia",
      "en": "Dark — Galaxy"
    },
    "preview": {
      "bgPrimary": "#100226",
      "bgSecondary": "#19023d",
      "bgTertiary": "#24015a",
      "bgCard": "rgba(25, 2, 61, 0.9)",
      "borderColor": "rgba(133, 115, 252, 0.28)",
      "borderFocus": "#8573fc",
      "textPrimary": "#f7f6f9",
      "textSecondary": "#d5cce0",
      "textMuted": "#aa98c3",
      "accentCyan": "#73aafc",
      "accentBlue": "#8573fc",
      "accentPurple": "#fc73ee",
      "accentPink": "#fc7373",
      "accentGreen": "#73fcf8",
      "accentOrange": "#fcee73",
      "accentRed": "#fcae73",
      "accentYellow": "#d9ff70",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-16": {
    "value": "dark-16",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Cerise",
      "de": "Dunkel — Kirsche",
      "es": "Oscuro — Cereza",
      "it": "Scuro — Ciliegia",
      "en": "Dark — Cherry"
    },
    "preview": {
      "bgPrimary": "#1c0305",
      "bgSecondary": "#320408",
      "bgTertiary": "#4d050b",
      "bgCard": "rgba(50, 4, 8, 0.9)",
      "borderColor": "rgba(105, 138, 247, 0.28)",
      "borderFocus": "#698af7",
      "textPrimary": "#f9f6f6",
      "textSecondary": "#e0ccce",
      "textMuted": "#c3989c",
      "accentCyan": "#69d6f7",
      "accentBlue": "#698af7",
      "accentPurple": "#d169f7",
      "accentPink": "#f7699d",
      "accentGreen": "#69f7be",
      "accentOrange": "#f7b569",
      "accentRed": "#f77269",
      "accentYellow": "#fced64",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-17": {
    "value": "dark-17",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Abysse",
      "de": "Dunkel — Abgrund",
      "es": "Oscuro — Abismo",
      "it": "Scuro — Abisso",
      "en": "Dark — Abyss"
    },
    "preview": {
      "bgPrimary": "#001820",
      "bgSecondary": "#002937",
      "bgTertiary": "#003e53",
      "bgCard": "rgba(0, 41, 55, 0.9)",
      "borderColor": "rgba(116, 184, 251, 0.28)",
      "borderFocus": "#74b8fb",
      "textPrimary": "#f6f8f9",
      "textSecondary": "#ccdde0",
      "textMuted": "#98bcc3",
      "accentCyan": "#74fbf6",
      "accentBlue": "#74b8fb",
      "accentPurple": "#c18dfb",
      "accentPink": "#fb74c9",
      "accentGreen": "#74fba1",
      "accentOrange": "#fb9874",
      "accentRed": "#fb7b95",
      "accentYellow": "#ffcb70",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-18": {
    "value": "dark-18",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Mousse",
      "de": "Dunkel — Moos",
      "es": "Oscuro — Musgo",
      "it": "Scuro — Muschio",
      "en": "Dark — Moss"
    },
    "preview": {
      "bgPrimary": "#16301b",
      "bgSecondary": "#1b4222",
      "bgTertiary": "#21582c",
      "bgCard": "rgba(27, 66, 34, 0.9)",
      "borderColor": "rgba(154, 199, 218, 0.28)",
      "borderFocus": "#9ac7da",
      "textPrimary": "#f7f9f6",
      "textSecondary": "#d1e0cc",
      "textMuted": "#acc9a2",
      "accentCyan": "#93d7c7",
      "accentBlue": "#9ac7da",
      "accentPurple": "#c6bae6",
      "accentPink": "#e2b1da",
      "accentGreen": "#93d79c",
      "accentOrange": "#e3b6b3",
      "accentRed": "#e3b3c6",
      "accentYellow": "#e0b89b",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-19": {
    "value": "dark-19",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Crépuscule",
      "de": "Dunkel — Dämmerung",
      "es": "Oscuro — Crepúsculo",
      "it": "Scuro — Crepuscolo",
      "en": "Dark — Dusk"
    },
    "preview": {
      "bgPrimary": "#251127",
      "bgSecondary": "#361639",
      "bgTertiary": "#4b1c4f",
      "bgCard": "rgba(54, 22, 57, 0.9)",
      "borderColor": "rgba(153, 147, 236, 0.28)",
      "borderFocus": "#9993ec",
      "textPrimary": "#f8f6f9",
      "textSecondary": "#decce0",
      "textMuted": "#bf98c3",
      "accentCyan": "#93bcec",
      "accentBlue": "#9993ec",
      "accentPurple": "#ec93e9",
      "accentPink": "#ec9399",
      "accentGreen": "#93ece3",
      "accentOrange": "#ecdd93",
      "accentRed": "#ecb393",
      "accentYellow": "#dcf08f",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "dark-20": {
    "value": "dark-20",
    "mode": "dark",
    "labels": {
      "fr": "Sombre — Graphite",
      "de": "Dunkel — Graphit",
      "es": "Oscuro — Grafito",
      "it": "Scuro — Grafite",
      "en": "Dark — Graphite"
    },
    "preview": {
      "bgPrimary": "#161718",
      "bgSecondary": "#1f2226",
      "bgTertiary": "#2a3037",
      "bgCard": "rgba(31, 34, 38, 0.9)",
      "borderColor": "rgba(162, 176, 205, 0.28)",
      "borderFocus": "#a2b0cd",
      "textPrimary": "#f6f7f9",
      "textSecondary": "#ccd6e0",
      "textMuted": "#98adc3",
      "accentCyan": "#a2c7cd",
      "accentBlue": "#a2b0cd",
      "accentPurple": "#bda2cd",
      "accentPink": "#cda2b6",
      "accentGreen": "#a2cdb8",
      "accentOrange": "#cdb5a2",
      "accentRed": "#cda2a4",
      "accentYellow": "#d1c79e",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.58), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
    }
  },
  "light-01": {
    "value": "light-01",
    "mode": "light",
    "labels": {
      "fr": "Clair — Pur",
      "de": "Hell — Klar",
      "es": "Claro — Limpio",
      "it": "Chiaro — Pulito",
      "en": "Light — Clean"
    },
    "preview": {
      "bgPrimary": "#e8f0f8",
      "bgSecondary": "#f8fafc",
      "bgTertiary": "#cfdeee",
      "bgCard": "rgba(248, 250, 252, 0.96)",
      "borderColor": "rgba(24, 66, 149, 0.26)",
      "borderFocus": "#184295",
      "textPrimary": "#1f3047",
      "textSecondary": "#344d6f",
      "textMuted": "#445e83",
      "accentCyan": "#136572",
      "accentBlue": "#184295",
      "accentPurple": "#671895",
      "accentPink": "#951853",
      "accentGreen": "#11693d",
      "accentOrange": "#8f4b18",
      "accentRed": "#95181c",
      "accentYellow": "#6d5a0d",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-02": {
    "value": "light-02",
    "mode": "light",
    "labels": {
      "fr": "Clair — Ciel",
      "de": "Hell — Himmel",
      "es": "Claro — Cielo",
      "it": "Chiaro — Cielo",
      "en": "Light — Sky"
    },
    "preview": {
      "bgPrimary": "#c1ecf9",
      "bgSecondary": "#d6f0f8",
      "bgTertiary": "#a4e0f3",
      "bgCard": "rgba(214, 240, 248, 0.96)",
      "borderColor": "rgba(14, 44, 144, 0.26)",
      "borderFocus": "#0e2c90",
      "textPrimary": "#1f3347",
      "textSecondary": "#34526f",
      "textMuted": "#3b5772",
      "accentCyan": "#0b5c74",
      "accentBlue": "#0e2c90",
      "accentPurple": "#6d0e90",
      "accentPink": "#900e3e",
      "accentGreen": "#0a613e",
      "accentOrange": "#7d490c",
      "accentRed": "#90170e",
      "accentYellow": "#605706",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-03": {
    "value": "light-03",
    "mode": "light",
    "labels": {
      "fr": "Clair — Menthe",
      "de": "Hell — Minze",
      "es": "Claro — Menta",
      "it": "Chiaro — Menta",
      "en": "Light — Mint"
    },
    "preview": {
      "bgPrimary": "#c8f8d8",
      "bgSecondary": "#ddf8e6",
      "bgTertiary": "#abf1c3",
      "bgCard": "rgba(221, 248, 230, 0.96)",
      "borderColor": "rgba(30, 76, 128, 0.26)",
      "borderFocus": "#1e4c80",
      "textPrimary": "#1f4730",
      "textSecondary": "#336c4a",
      "textMuted": "#376c4d",
      "accentCyan": "#196b6b",
      "accentBlue": "#1e4c80",
      "accentPurple": "#4f1e80",
      "accentPink": "#801e59",
      "accentGreen": "#1a7039",
      "accentOrange": "#803b1e",
      "accentRed": "#801e2e",
      "accentYellow": "#7c5b18",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-04": {
    "value": "light-04",
    "mode": "light",
    "labels": {
      "fr": "Clair — Pêche",
      "de": "Hell — Pfirsich",
      "es": "Claro — Melocotón",
      "it": "Chiaro — Pesca",
      "en": "Light — Peach"
    },
    "preview": {
      "bgPrimary": "#f9dfe4",
      "bgSecondary": "#fbf1f3",
      "bgTertiary": "#f1c3cc",
      "bgCard": "rgba(251, 241, 243, 0.96)",
      "borderColor": "rgba(27, 77, 152, 0.26)",
      "borderFocus": "#1b4d98",
      "textPrimary": "#472f1f",
      "textSecondary": "#6f4c34",
      "textMuted": "#71503a",
      "accentCyan": "#126065",
      "accentBlue": "#1b4d98",
      "accentPurple": "#621b98",
      "accentPink": "#981b5d",
      "accentGreen": "#116435",
      "accentOrange": "#8b4218",
      "accentRed": "#981b27",
      "accentYellow": "#6c530e",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-05": {
    "value": "light-05",
    "mode": "light",
    "labels": {
      "fr": "Clair — Lavande",
      "de": "Hell — Lavendel",
      "es": "Claro — Lavanda",
      "it": "Chiaro — Lavanda",
      "en": "Light — Lavender"
    },
    "preview": {
      "bgPrimary": "#e4d8fa",
      "bgSecondary": "#f1ebfb",
      "bgTertiary": "#cfbbf4",
      "bgCard": "rgba(241, 235, 251, 0.96)",
      "borderColor": "rgba(29, 52, 144, 0.26)",
      "borderFocus": "#1d3490",
      "textPrimary": "#291f47",
      "textSecondary": "#43346f",
      "textMuted": "#564586",
      "accentCyan": "#16576e",
      "accentBlue": "#1d3490",
      "accentPurple": "#751d90",
      "accentPink": "#901d44",
      "accentGreen": "#135b40",
      "accentOrange": "#6e4816",
      "accentRed": "#90291d",
      "accentYellow": "#56510e",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-06": {
    "value": "light-06",
    "mode": "light",
    "labels": {
      "fr": "Clair — Citron",
      "de": "Hell — Zitrone",
      "es": "Claro — Limón",
      "it": "Chiaro — Limone",
      "en": "Light — Lemon"
    },
    "preview": {
      "bgPrimary": "#f9f3cd",
      "bgSecondary": "#f9f6e1",
      "bgTertiary": "#f3eaaf",
      "bgCard": "rgba(249, 246, 225, 0.96)",
      "borderColor": "rgba(21, 74, 127, 0.26)",
      "borderFocus": "#154a7f",
      "textPrimary": "#47421f",
      "textSecondary": "#6f6734",
      "textMuted": "#6f6839",
      "accentCyan": "#13726f",
      "accentBlue": "#154a7f",
      "accentPurple": "#46157f",
      "accentPink": "#7f1558",
      "accentGreen": "#137634",
      "accentOrange": "#7f3115",
      "accentRed": "#7f152a",
      "accentYellow": "#845910",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-07": {
    "value": "light-07",
    "mode": "light",
    "labels": {
      "fr": "Clair — Rose",
      "de": "Hell — Rose",
      "es": "Claro — Rosa",
      "it": "Chiaro — Rosa",
      "en": "Light — Rose"
    },
    "preview": {
      "bgPrimary": "#f3ced8",
      "bgSecondary": "#f5e1e6",
      "bgTertiary": "#e9b4c3",
      "bgCard": "rgba(245, 225, 230, 0.96)",
      "borderColor": "rgba(21, 74, 153, 0.26)",
      "borderFocus": "#154a99",
      "textPrimary": "#471f22",
      "textSecondary": "#6f3439",
      "textMuted": "#783d42",
      "accentCyan": "#0c575c",
      "accentBlue": "#154a99",
      "accentPurple": "#5f1599",
      "accentPink": "#951458",
      "accentGreen": "#0c5a2e",
      "accentOrange": "#803a11",
      "accentRed": "#991522",
      "accentYellow": "#614a0a",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-08": {
    "value": "light-08",
    "mode": "light",
    "labels": {
      "fr": "Clair — Aqua",
      "de": "Hell — Aqua",
      "es": "Claro — Aqua",
      "it": "Chiaro — Acqua",
      "en": "Light — Aqua"
    },
    "preview": {
      "bgPrimary": "#cff7f5",
      "bgSecondary": "#e3f8f7",
      "bgTertiary": "#b4eeed",
      "bgCard": "rgba(227, 248, 247, 0.96)",
      "borderColor": "rgba(22, 52, 136, 0.26)",
      "borderFocus": "#163488",
      "textPrimary": "#1f4746",
      "textSecondary": "#336c6a",
      "textMuted": "#376c6a",
      "accentCyan": "#156a7f",
      "accentBlue": "#163488",
      "accentPurple": "#661688",
      "accentPink": "#881644",
      "accentGreen": "#137249",
      "accentOrange": "#884f16",
      "accentRed": "#881a16",
      "accentYellow": "#71640e",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-09": {
    "value": "light-09",
    "mode": "light",
    "labels": {
      "fr": "Clair — Sauge",
      "de": "Hell — Salbei",
      "es": "Claro — Salvia",
      "it": "Chiaro — Salvia",
      "en": "Light — Sage"
    },
    "preview": {
      "bgPrimary": "#dcefdc",
      "bgSecondary": "#ecf4ec",
      "bgTertiary": "#c6e1c6",
      "bgCard": "rgba(236, 244, 236, 0.96)",
      "borderColor": "rgba(44, 89, 119, 0.26)",
      "borderFocus": "#2c5977",
      "textPrimary": "#25471f",
      "textSecondary": "#3a6831",
      "textMuted": "#3c6534",
      "accentCyan": "#27685f",
      "accentBlue": "#2c5977",
      "accentPurple": "#482c77",
      "accentPink": "#772c63",
      "accentGreen": "#276836",
      "accentOrange": "#77392c",
      "accentRed": "#772c43",
      "accentYellow": "#7c5427",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-10": {
    "value": "light-10",
    "mode": "light",
    "labels": {
      "fr": "Clair — Lilas",
      "de": "Hell — Flieder",
      "es": "Claro — Lila",
      "it": "Chiaro — Lillà",
      "en": "Light — Lilac"
    },
    "preview": {
      "bgPrimary": "#f5d8f6",
      "bgSecondary": "#f8eaf8",
      "bgTertiary": "#ebbeed",
      "bgCard": "rgba(248, 234, 248, 0.96)",
      "borderColor": "rgba(34, 60, 145, 0.26)",
      "borderFocus": "#223c91",
      "textPrimary": "#3d1f47",
      "textSecondary": "#60346f",
      "textMuted": "#6d407d",
      "accentCyan": "#19586b",
      "accentBlue": "#223c91",
      "accentPurple": "#732291",
      "accentPink": "#91224a",
      "accentGreen": "#155b3f",
      "accentOrange": "#72491b",
      "accentRed": "#912922",
      "accentYellow": "#5a5311",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-11": {
    "value": "light-11",
    "mode": "light",
    "labels": {
      "fr": "Clair — Crème",
      "de": "Hell — Creme",
      "es": "Claro — Crema",
      "it": "Chiaro — Crema",
      "en": "Light — Cream"
    },
    "preview": {
      "bgPrimary": "#f5efe0",
      "bgSecondary": "#f9f6f1",
      "bgTertiary": "#eadfc8",
      "bgCard": "rgba(249, 246, 241, 0.96)",
      "borderColor": "rgba(35, 74, 118, 0.26)",
      "borderFocus": "#234a76",
      "textPrimary": "#473b1f",
      "textSecondary": "#6f5d34",
      "textMuted": "#6f5f39",
      "accentCyan": "#206a6a",
      "accentBlue": "#234a76",
      "accentPurple": "#4d2376",
      "accentPink": "#762355",
      "accentGreen": "#216e3d",
      "accentOrange": "#763c23",
      "accentRed": "#762331",
      "accentYellow": "#7a5c1f",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-12": {
    "value": "light-12",
    "mode": "light",
    "labels": {
      "fr": "Clair — Glace",
      "de": "Hell — Eis",
      "es": "Claro — Hielo",
      "it": "Chiaro — Ghiaccio",
      "en": "Light — Ice"
    },
    "preview": {
      "bgPrimary": "#c2e0f0",
      "bgSecondary": "#d5e7f0",
      "bgTertiary": "#a9d1e5",
      "bgCard": "rgba(213, 231, 240, 0.96)",
      "borderColor": "rgba(42, 78, 132, 0.26)",
      "borderFocus": "#2a4e84",
      "textPrimary": "#1f3a47",
      "textSecondary": "#33596c",
      "textMuted": "#365768",
      "accentCyan": "#1f5c61",
      "accentBlue": "#2a4e84",
      "accentPurple": "#5d2a84",
      "accentPink": "#842a5a",
      "accentGreen": "#1d5d39",
      "accentOrange": "#7c4627",
      "accentRed": "#842a33",
      "accentYellow": "#65511b",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-13": {
    "value": "light-13",
    "mode": "light",
    "labels": {
      "fr": "Clair — Fleur",
      "de": "Hell — Blüte",
      "es": "Claro — Flor",
      "it": "Chiaro — Fiore",
      "en": "Light — Blossom"
    },
    "preview": {
      "bgPrimary": "#f2bedb",
      "bgSecondary": "#f2d2e4",
      "bgTertiary": "#e9a4ca",
      "bgCard": "rgba(242, 210, 228, 0.96)",
      "borderColor": "rgba(26, 66, 147, 0.26)",
      "borderFocus": "#1a4293",
      "textPrimary": "#471f33",
      "textSecondary": "#6f3452",
      "textMuted": "#6b3752",
      "accentCyan": "#104f59",
      "accentBlue": "#1a4293",
      "accentPurple": "#671a93",
      "accentPink": "#88184d",
      "accentGreen": "#0e5330",
      "accentOrange": "#6d3a14",
      "accentRed": "#8c191d",
      "accentYellow": "#56460b",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-14": {
    "value": "light-14",
    "mode": "light",
    "labels": {
      "fr": "Clair — Écume",
      "de": "Hell — Meerschaum",
      "es": "Claro — Espuma de mar",
      "it": "Chiaro — Schiuma di mare",
      "en": "Light — Seafoam"
    },
    "preview": {
      "bgPrimary": "#ccefe9",
      "bgSecondary": "#def1ee",
      "bgTertiary": "#b4e3db",
      "bgCard": "rgba(222, 241, 238, 0.96)",
      "borderColor": "rgba(35, 58, 123, 0.26)",
      "borderFocus": "#233a7b",
      "textPrimary": "#1f473b",
      "textSecondary": "#306657",
      "textMuted": "#356658",
      "accentCyan": "#226677",
      "accentBlue": "#233a7b",
      "accentPurple": "#61237b",
      "accentPink": "#7b2346",
      "accentGreen": "#1d6949",
      "accentOrange": "#7b4f23",
      "accentRed": "#7b2623",
      "accentYellow": "#675d18",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-15": {
    "value": "light-15",
    "mode": "light",
    "labels": {
      "fr": "Clair — Abricot",
      "de": "Hell — Aprikose",
      "es": "Claro — Albaricoque",
      "it": "Chiaro — Albicocca",
      "en": "Light — Apricot"
    },
    "preview": {
      "bgPrimary": "#fbe1bf",
      "bgSecondary": "#f9ead5",
      "bgTertiary": "#f6d1a1",
      "bgCard": "rgba(249, 234, 213, 0.96)",
      "borderColor": "rgba(31, 48, 132, 0.26)",
      "borderFocus": "#1f3084",
      "textPrimary": "#47341f",
      "textSecondary": "#6f5434",
      "textMuted": "#6f5639",
      "accentCyan": "#1e6380",
      "accentBlue": "#1f3084",
      "accentPurple": "#701f84",
      "accentPink": "#841f3d",
      "accentGreen": "#18674d",
      "accentOrange": "#7a551d",
      "accentRed": "#842c1f",
      "accentYellow": "#5e5c12",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-16": {
    "value": "light-16",
    "mode": "light",
    "labels": {
      "fr": "Clair — Pervenche",
      "de": "Hell — Immergrün",
      "es": "Claro — Bígaro",
      "it": "Chiaro — Pervinca",
      "en": "Light — Periwinkle"
    },
    "preview": {
      "bgPrimary": "#ccd2fb",
      "bgSecondary": "#e1e4fa",
      "bgTertiary": "#aeb7f6",
      "bgCard": "rgba(225, 228, 250, 0.96)",
      "borderColor": "rgba(20, 50, 148, 0.26)",
      "borderFocus": "#143294",
      "textPrimary": "#1f2247",
      "textSecondary": "#34396f",
      "textMuted": "#41457c",
      "accentCyan": "#0e5065",
      "accentBlue": "#143294",
      "accentPurple": "#721494",
      "accentPink": "#901341",
      "accentGreen": "#0c5337",
      "accentOrange": "#693f0e",
      "accentRed": "#901c13",
      "accentYellow": "#524a08",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-17": {
    "value": "light-17",
    "mode": "light",
    "labels": {
      "fr": "Clair — Grès",
      "de": "Hell — Sandstein",
      "es": "Claro — Arenisca",
      "it": "Chiaro — Arenaria",
      "en": "Light — Sandstone"
    },
    "preview": {
      "bgPrimary": "#e8dbcf",
      "bgSecondary": "#ebe6e0",
      "bgTertiary": "#d9c9ba",
      "bgCard": "rgba(235, 230, 224, 0.96)",
      "borderColor": "rgba(41, 74, 117, 0.26)",
      "borderFocus": "#294a75",
      "textPrimary": "#47331f",
      "textSecondary": "#6c4f33",
      "textMuted": "#684f36",
      "accentCyan": "#215c5e",
      "accentBlue": "#294a75",
      "accentPurple": "#522975",
      "accentPink": "#752954",
      "accentGreen": "#215e3a",
      "accentOrange": "#754229",
      "accentRed": "#752933",
      "accentYellow": "#66511e",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-18": {
    "value": "light-18",
    "mode": "light",
    "labels": {
      "fr": "Clair — Orchidée",
      "de": "Hell — Orchidee",
      "es": "Claro — Orquídea",
      "it": "Chiaro — Orchidea",
      "en": "Light — Orchid"
    },
    "preview": {
      "bgPrimary": "#e5bff4",
      "bgSecondary": "#ebd4f4",
      "bgTertiary": "#d7a4eb",
      "bgCard": "rgba(235, 212, 244, 0.96)",
      "borderColor": "rgba(29, 49, 144, 0.26)",
      "borderFocus": "#1d3190",
      "textPrimary": "#471f42",
      "textSecondary": "#6a3262",
      "textMuted": "#673560",
      "accentCyan": "#154c64",
      "accentBlue": "#1d3190",
      "accentPurple": "#721b88",
      "accentPink": "#851b3b",
      "accentGreen": "#104f39",
      "accentOrange": "#5e3f13",
      "accentRed": "#81281b",
      "accentYellow": "#4b490c",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-19": {
    "value": "light-19",
    "mode": "light",
    "labels": {
      "fr": "Clair — Nuage",
      "de": "Hell — Wolke",
      "es": "Claro — Nube",
      "it": "Chiaro — Nuvola",
      "en": "Light — Cloud"
    },
    "preview": {
      "bgPrimary": "#e3e5e7",
      "bgSecondary": "#eceff2",
      "bgTertiary": "#cbd3db",
      "bgCard": "rgba(236, 239, 242, 0.96)",
      "borderColor": "rgba(54, 74, 114, 0.26)",
      "borderFocus": "#364a72",
      "textPrimary": "#1f3347",
      "textSecondary": "#34526f",
      "textMuted": "#3d5976",
      "accentCyan": "#2f5d65",
      "accentBlue": "#364a72",
      "accentPurple": "#5c3672",
      "accentPink": "#723652",
      "accentGreen": "#2e6147",
      "accentOrange": "#725036",
      "accentRed": "#723638",
      "accentYellow": "#625628",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  },
  "light-20": {
    "value": "light-20",
    "mode": "light",
    "labels": {
      "fr": "Clair — Porcelaine",
      "de": "Hell — Porzellan",
      "es": "Claro — Porcelana",
      "it": "Chiaro — Porcellana",
      "en": "Light — Porcelain"
    },
    "preview": {
      "bgPrimary": "#f9fafb",
      "bgSecondary": "#fcfdfd",
      "bgTertiary": "#e4ebec",
      "bgCard": "rgba(252, 253, 253, 0.96)",
      "borderColor": "rgba(49, 87, 125, 0.26)",
      "borderFocus": "#31577d",
      "textPrimary": "#1f4147",
      "textSecondary": "#34656f",
      "textMuted": "#3e6f79",
      "accentCyan": "#2c7270",
      "accentBlue": "#31577d",
      "accentPurple": "#54317d",
      "accentPink": "#7d3161",
      "accentGreen": "#2c7243",
      "accentOrange": "#7d4531",
      "accentRed": "#7d3140",
      "accentYellow": "#82622b",
      "shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
    }
  }
};

export const THEME_VALUES = Object.keys(THEME_CATALOG);
export const DEFAULT_THEME_VALUE = 'dark-01';
export const DEFAULT_THEME_PREVIEW = THEME_CATALOG[DEFAULT_THEME_VALUE].preview;

export function isThemeValue(value: unknown, catalog: Record<string, ThemeCatalogEntry> = THEME_CATALOG): value is string {
  return typeof value === 'string' && value in catalog;
}

export function getThemeLabel(
  value: string,
  language: Language,
  catalog: Record<string, ThemeCatalogEntry> = THEME_CATALOG
): string {
  return catalog[value]?.labels[language] || value;
}

export function getThemePreview(
  value: string,
  catalog: Record<string, ThemeCatalogEntry> = THEME_CATALOG
): ThemePreview | undefined {
  return catalog[value]?.preview;
}
