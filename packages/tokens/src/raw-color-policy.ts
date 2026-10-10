export const CANONICAL_TOKEN_SOURCE_PATH =
  "packages/tokens/src/token-source.ts" as const;
export const GENERATED_TOKEN_CSS_PATH = "packages/tokens/dist/tokens.css" as const;
export const RAW_COLOR_CONTRACT_DEFINITION =
  `${CANONICAL_TOKEN_SOURCE_PATH}#canonical-token-source` as const;

export type RawColorSyntax =
  | "hex"
  | "rgb"
  | "hsl"
  | "hwb"
  | "lab"
  | "lch"
  | "oklab"
  | "oklch"
  | "color"
  | "color-mix"
  | "device-cmyk"
  | "named";

export interface RawColorMatch {
  readonly value: string;
  readonly syntax: RawColorSyntax;
  readonly index: number;
  readonly length: number;
}

const RAW_COLOR_PATTERNS: ReadonlyArray<{
  readonly syntax: RawColorSyntax;
  readonly pattern: RegExp;
}> = [
  { syntax: "hex", pattern: /#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{4}\b|#[\da-f]{3}\b/gi },
  { syntax: "rgb", pattern: /\brgba?\s*\(/gi },
  { syntax: "hsl", pattern: /\bhsla?\s*\(/gi },
  { syntax: "hwb", pattern: /\bhwb\s*\(/gi },
  { syntax: "lab", pattern: /\blab\s*\(/gi },
  { syntax: "lch", pattern: /\blch\s*\(/gi },
  { syntax: "oklab", pattern: /\boklab\s*\(/gi },
  { syntax: "oklch", pattern: /\boklch\s*\(/gi },
  { syntax: "color-mix", pattern: /\bcolor-mix\s*\(/gi },
  { syntax: "color", pattern: /\bcolor\s*\(/gi },
  { syntax: "device-cmyk", pattern: /\bdevice-cmyk\s*\(/gi }
];

const CSS_NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond " +
    "blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue " +
    "cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey " +
    "darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon " +
    "darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet " +
    "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen " +
    "fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew " +
    "hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon " +
    "lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey " +
    "lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey " +
    "lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine " +
    "mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen " +
    "mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite " +
    "navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen " +
    "paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple " +
    "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell " +
    "sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan " +
    "teal thistle tomato transparent turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" ")
);

const CSS_COLOR_PROPERTIES = /^(?:--[\w-]+|(?:background|border(?:-(?:block|inline)(?:-(?:start|end))?|-(?:top|right|bottom|left))?|column-rule|outline|text-decoration|text-emphasis|-webkit-text-stroke)(?:-color)?|color|accent-color|caret-color|fill|stroke|stop-color|flood-color|lighting-color|text-shadow|box-shadow|filter|-webkit-filter|-webkit-text-fill-color)$/iu;

function blankRange(characters: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1) {
    if (characters[index] !== "\n" && characters[index] !== "\r") characters[index] = " ";
  }
}

function cssNewlineWidth(text: string, index: number): number {
  if (text[index] === "\r" && text[index + 1] === "\n") return 2;
  return text[index] === "\n" || text[index] === "\r" || text[index] === "\f" ? 1 : 0;
}

function cssCodePointWidth(text: string, index: number): number {
  const codePoint = text.codePointAt(index);
  return codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
}

function consumeCssEscapedCodePoint(text: string, start: number): number {
  // CSS Syntax 3, §4.3.7. Decoding is unnecessary for lexical neutralization,
  // but consuming the exact source span preserves the original diagnostic offsets.
  let index = start;
  if (/[\da-f]/iu.test(text[index] ?? "")) {
    let digits = 0;
    while (digits < 6 && /[\da-f]/iu.test(text[index] ?? "")) {
      index += 1;
      digits += 1;
    }
    const newlineWidth = cssNewlineWidth(text, index);
    if (newlineWidth > 0) return index + newlineWidth;
    if (text[index] === " " || text[index] === "\t") return index + 1;
    return index;
  }
  return Math.min(text.length, index + cssCodePointWidth(text, index));
}

function consumeCssString(text: string, start: number, endingQuote: string): number {
  // CSS Syntax 3, §4.3.5, applied to raw source while accounting for the
  // standard's preprocessing of CR, FF, and CRLF into a single newline.
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === endingQuote) return index + 1;

    const newlineWidth = cssNewlineWidth(text, index);
    if (newlineWidth > 0) {
      // Reconsume the newline outside the bad-string token.
      return index;
    }

    if (text[index] === "\\") {
      if (index + 1 >= text.length) return text.length;
      const escapedNewlineWidth = cssNewlineWidth(text, index + 1);
      if (escapedNewlineWidth > 0) {
        index += 1 + escapedNewlineWidth;
      } else {
        index = consumeCssEscapedCodePoint(text, index + 1);
      }
      continue;
    }

    index += cssCodePointWidth(text, index);
  }
  return text.length;
}

function neutralizeCssLexicalNonValues(text: string): string {
  // Phase 1 tokenizes strings and comments into same-width blanks. Structural
  // delimiters inside them therefore cannot manufacture declarations, while
  // every retained character keeps its original source index.
  const characters = text.split("");
  let index = 0;
  while (index < text.length) {
    const current = text[index];
    const next = text[index + 1];
    if (current === "/" && next === "*") {
      const start = index;
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      if (index < text.length) index += 2;
      blankRange(characters, start, index);
      continue;
    }
    if (current === '"' || current === "'") {
      const start = index;
      index = consumeCssString(text, start, current);
      blankRange(characters, start, index);
      continue;
    }
    index += 1;
  }

  // Phase 2 tokenizes function boundaries before declarations are recognized.
  // URL payloads are non-color resources and are blanked wholesale. Other
  // functions remain visible so var() fallbacks and drop-shadow colors can be
  // inspected, but their nested delimiters lose declaration authority.
  const stringsAndCommentsNeutral = characters.join("");
  index = 0;
  let functionDepth = 0;
  while (index < stringsAndCommentsNeutral.length) {
    if (stringsAndCommentsNeutral[index] === "\\") {
      index = Math.min(stringsAndCommentsNeutral.length, index + 2);
      continue;
    }
    if (stringsAndCommentsNeutral[index] === "(") {
      let nameEnd = index;
      while (nameEnd > 0 && /\s/u.test(stringsAndCommentsNeutral[nameEnd - 1] ?? "")) nameEnd -= 1;
      let nameStart = nameEnd;
      while (nameStart > 0 && /[-\w]/u.test(stringsAndCommentsNeutral[nameStart - 1] ?? "")) nameStart -= 1;
      const functionName = stringsAndCommentsNeutral.slice(nameStart, nameEnd).toLowerCase();
      if (functionName === "url") {
        let cursor = index + 1;
        let urlDepth = 1;
        while (cursor < stringsAndCommentsNeutral.length && urlDepth > 0) {
          if (stringsAndCommentsNeutral[cursor] === "\\") {
            cursor = Math.min(stringsAndCommentsNeutral.length, cursor + 2);
            continue;
          }
          if (stringsAndCommentsNeutral[cursor] === "(") urlDepth += 1;
          if (stringsAndCommentsNeutral[cursor] === ")") urlDepth -= 1;
          cursor += 1;
        }
        blankRange(characters, nameStart, cursor);
        index = cursor;
        continue;
      }
      functionDepth += 1;
      index += 1;
      continue;
    }
    if (stringsAndCommentsNeutral[index] === ")") {
      functionDepth = Math.max(0, functionDepth - 1);
      index += 1;
      continue;
    }
    if (functionDepth > 0 && ";{}".includes(stringsAndCommentsNeutral[index] ?? "")) {
      characters[index] = " ";
    }
    index += 1;
  }
  return characters.join("");
}

function findRawColorSyntaxes(text: string): RawColorMatch[] {
  const matches: RawColorMatch[] = [];
  for (const { syntax, pattern } of RAW_COLOR_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = match[0];
      matches.push({ value, syntax, index: match.index, length: value.length });
    }
  }
  return matches;
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isRawColorPolicyExemptPath(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath);
  return (
    normalized === CANONICAL_TOKEN_SOURCE_PATH ||
    normalized.endsWith(`/${CANONICAL_TOKEN_SOURCE_PATH}`) ||
    normalized === GENERATED_TOKEN_CSS_PATH ||
    normalized.endsWith(`/${GENERATED_TOKEN_CSS_PATH}`)
  );
}

export function findRawColors(text: string): readonly RawColorMatch[] {
  const matches = findRawColorSyntaxes(text);

  const trimmed = text.trim();
  if (CSS_NAMED_COLORS.has(trimmed.toLowerCase())) {
    const index = text.indexOf(trimmed);
    matches.push({
      value: trimmed,
      syntax: "named",
      index,
      length: trimmed.length
    });
  }

  return matches.sort((left, right) => left.index - right.index);
}

export function findRawColorsInFile(
  text: string,
  filePath: string
): readonly RawColorMatch[] {
  return isRawColorPolicyExemptPath(filePath) ? [] : findRawColors(text);
}

export function findRawColorsInCssFile(
  text: string,
  filePath: string,
): readonly RawColorMatch[] {
  if (isRawColorPolicyExemptPath(filePath)) return [];
  const lexicalNeutral = neutralizeCssLexicalNonValues(text);
  const matches: RawColorMatch[] = [];
  const declaration = /(?:^|[;{])\s*([-\w]+)\s*:\s*([^;{}]+)/gmu;
  for (const valueMatch of lexicalNeutral.matchAll(declaration)) {
    const property = valueMatch[1];
    const value = valueMatch[2];
    if (!property || !value) continue;
    const valueStart = valueMatch.index + valueMatch[0].indexOf(value);
    for (const match of findRawColorSyntaxes(value)) {
      matches.push({ ...match, index: valueStart + match.index });
    }
    if (!CSS_COLOR_PROPERTIES.test(property)) continue;
    for (const word of value.matchAll(/(?<![-\w])[a-z]+(?![-\w])/gi)) {
      if (CSS_NAMED_COLORS.has(word[0].toLowerCase())) {
        matches.push({
          value: word[0],
          syntax: "named",
          index: valueStart + word.index,
          length: word[0].length,
        });
      }
    }
  }
  return matches.sort((left, right) => left.index - right.index);
}
