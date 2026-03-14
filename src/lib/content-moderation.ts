const LEETSPEAK_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
};

const PROHIBITED_TERMS = [
  "adulto",
  "adult content",
  "anal",
  "asshole",
  "bastard",
  "bitch",
  "boobs",
  "cabron",
  "capullo",
  "cock",
  "coito",
  "cojer",
  "coger",
  "contenido adulto",
  "cunt",
  "cum",
  "chinga tu madre",
  "chingada",
  "chingar",
  "chingado",
  "desnuda",
  "desnudo",
  "estupida",
  "estupido",
  "faggot",
  "dildo",
  "erotica",
  "erotico",
  "fuck you",
  "fuck",
  "gilipollas",
  "hdp",
  "hentai",
  "hija de puta",
  "hijo de puta",
  "imbecil",
  "idiota",
  "joder",
  "maldita",
  "maldito",
  "masturbacion",
  "mierda",
  "milf",
  "motherfucker",
  "nude",
  "nudes",
  "nsfw",
  "pendeja",
  "pendejo",
  "perra",
  "orgasmo",
  "onlyfans",
  "pinche",
  "penis",
  "porn",
  "porno",
  "puta",
  "puto",
  "pussy",
  "retard",
  "suck my dick",
  "shit",
  "slut",
  "semen",
  "sexo",
  "sex",
  "sexy",
  "subnormal",
  "tarada",
  "tarado",
  "tetas",
  "tonto",
  "verguero",
  "vagina",
  "verga",
  "xvideos",
  "xxx",
];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[013457]/g, (char) => LEETSPEAK_MAP[char] ?? char)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_TERMS = PROHIBITED_TERMS.map((term) => ({
  raw: term,
  normalized: normalizeText(term),
})).filter((term) => term.normalized.length > 0);

export function findProhibitedTerms(text: string): string[] {
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return [];
  }

  const paddedText = ` ${normalizedText} `;
  const matches: string[] = [];

  for (const term of NORMALIZED_TERMS) {
    if (!term.normalized) {
      continue;
    }

    const found = term.normalized.includes(" ")
      ? normalizedText.includes(term.normalized)
      : paddedText.includes(` ${term.normalized} `);

    if (found && !matches.includes(term.raw)) {
      matches.push(term.raw);
    }
  }

  return matches;
}

export function buildProhibitedTermsError(
  label: string,
  text: string,
): string | null {
  const matches = findProhibitedTerms(text);
  if (!matches.length) {
    return null;
  }

  return `${label} contiene lenguaje no permitido.`;
}

export { PROHIBITED_TERMS };
