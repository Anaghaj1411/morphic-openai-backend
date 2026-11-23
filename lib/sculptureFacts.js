/**
 * Turns live sculpture JSON into facts the model must follow.
 * Hex codes are named here so the model never guesses a color.
 */

const SKIP_KEYS = new Set([
  "userquestion",
  "replyinstruction",
  "replylanguage",
  "message"
]);

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((n) => clampByte(n).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function parseHex(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const hexMatch = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 8) h = h.slice(0, 6);
    return rgbToHex(
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16)
    );
  }

  const fn = text.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i
  );
  if (!fn) return null;
  const channels = fn.slice(1, 4).map(Number);
  if (channels.some((n) => Number.isNaN(n))) return null;
  const scale = channels.every((n) => n <= 1) ? 255 : 1;
  return rgbToHex(channels[0] * scale, channels[1] * scale, channels[2] * scale);
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
      break;
  }
  return { h: h * 60, s, l };
}

/**
 * Everyday color name from a #RRGGBB code.
 * Light/dark/bright are added only when they change the reading.
 */
export function nameFromHex(hex) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);

  if (l <= 0.08) return "black";
  if (l >= 0.93 && s <= 0.12) return "white";

  if (s <= 0.1) {
    if (l < 0.28) return "black";
    if (l < 0.45) return "dark gray";
    if (l > 0.82) return "light gray";
    return "gray";
  }

  let base;
  if (h < 12 || h >= 345) base = "red";
  else if (h < 42) base = "orange";
  else if (h < 70) base = "yellow";
  else if (h < 90) base = "lime green";
  else if (h < 165) base = "green";
  else if (h < 200) base = l < 0.45 ? "teal" : "cyan";
  else if (h < 255) base = "blue";
  else if (h < 325) base = l >= 0.55 ? "pink" : "purple";
  else base = l >= 0.6 ? "pink" : "red";

  if (base === "red" && l >= 0.62 && s >= 0.15) base = "pink";

  // Brown, gold, beige, and tan are lightness variants of warm hues.
  if (h >= 8 && h < 50 && l >= 0.12 && l < 0.48 && s >= 0.2) {
    base = "brown";
  } else if (h >= 40 && h < 58 && l >= 0.4 && l <= 0.72 && s >= 0.4) {
    base = "gold";
  } else if (h >= 35 && h <= 80 && l >= 0.78 && s <= 0.65) {
    base = "beige";
  } else if (h >= 18 && h < 50 && s < 0.7 && l >= 0.55 && l < 0.82) {
    base = "tan";
  }

  if (base === "gold" || base === "beige" || base === "tan" || base === "brown") {
    if (base === "brown" && l < 0.32) return "dark brown";
    return base;
  }
  if (l < 0.32) return `dark ${base}`;
  if (l > 0.75) return `light ${base}`;
  if (s > 0.72 && l >= 0.4 && l <= 0.68) return `bright ${base}`;
  return base;
}

function titleCase(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function partFromKey(key) {
  if (typeof key !== "string") return null;
  const match = key.match(/^(.*?)[\s_-]*(?:colors?|colours?|hex|swatch|tint)$/i);
  if (!match) return null;
  const raw = match[1]
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (!raw || /^(main|primary|secondary|value|code|hex)$/i.test(raw)) return null;
  return titleCase(raw);
}

function siblingPart(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  for (const key of ["part", "partName", "target", "slot", "name", "label"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim() && value.length <= 48) {
      return value.trim();
    }
  }
  return null;
}

function isRgbObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const r = obj.r ?? obj.R;
  const g = obj.g ?? obj.G;
  const b = obj.b ?? obj.B;
  return [r, g, b].every((n) => typeof n === "number" && Number.isFinite(n));
}

function rgbObjectToHex(obj) {
  const r = obj.r ?? obj.R;
  const g = obj.g ?? obj.G;
  const b = obj.b ?? obj.B;
  const scale = [r, g, b].every((n) => n <= 1) ? 255 : 1;
  return rgbToHex(r * scale, g * scale, b * scale);
}

function colorKey(key) {
  return typeof key === "string" && /color|colour|hex|swatch|tint/i.test(key);
}

function partFromPaletteKey(key) {
  if (typeof key !== "string" || colorKey(key) || /^\d+$/.test(key)) return null;
  const raw = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (!raw || raw.length > 48) return null;
  return titleCase(raw);
}

function addColor(list, seen, entry) {
  const id = `${(entry.part || "").toLowerCase()}|${entry.hex}`;
  if (seen.has(id)) return;
  seen.add(id);
  list.push(entry);
}

function walkColors(node, key, part, list, seen, inColor = false) {
  if (node == null) return;
  if (typeof key === "string" && SKIP_KEYS.has(key.toLowerCase())) return;

  const keyIsColor = colorKey(key);
  const nextPart =
    partFromKey(key) || (inColor ? partFromPaletteKey(key) : null) || part;
  const collect = keyIsColor || inColor || Boolean(partFromKey(key));

  if (typeof node === "string") {
    const hex = parseHex(node);
    if (hex && collect) {
      addColor(list, seen, {
        part: nextPart,
        hex,
        name: nameFromHex(hex)
      });
    }
    return;
  }

  if (isRgbObject(node) && collect) {
    const hex = rgbObjectToHex(node);
    addColor(list, seen, {
      part: nextPart,
      hex,
      name: nameFromHex(hex)
    });
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkColors(item, key, nextPart, list, seen, keyIsColor || inColor);
    }
    return;
  }

  if (typeof node === "object") {
    const here = siblingPart(node) || nextPart;
    for (const [childKey, child] of Object.entries(node)) {
      walkColors(
        child,
        childKey,
        partFromKey(childKey) || here,
        list,
        seen,
        keyIsColor || inColor
      );
    }
  }
}

const SHARED_COLOR_PARTS = {
  band: "Band",
  drawband: "Band",
  stamp: "Stamp",
  design: "Stamp",
  clay: "Clay",
  coil: "Clay",
  vertex: "Clay"
};

const LANTERN_COLOR_PARTS = {
  ...SHARED_COLOR_PARTS,
  body: "Lantern Body",
  lanternbody: "Lantern Body",
  top: "Lantern Top",
  lanterntop: "Lantern Top",
  toplid: "Lantern Top",
  lidtop: "Lantern Top",
  bottom: "Lantern Bottom",
  lanternbottom: "Lantern Bottom",
  bottomlid: "Lantern Bottom",
  lidbottom: "Lantern Bottom",
  tassel: "Lantern Tassel",
  lanterntassel: "Lantern Tassel",
  whole: "Whole Lantern",
  wholelantern: "Whole Lantern"
};

const TEAPOT_COLOR_PARTS = {
  ...SHARED_COLOR_PARTS,
  body: "Teapot Body",
  teapotbody: "Teapot Body",
  lanternbody: "Teapot Body",
  lid: "Teapot Lid",
  teapotlid: "Teapot Lid",
  top: "Teapot Lid",
  lanterntop: "Teapot Lid",
  toplid: "Teapot Lid",
  lidtop: "Teapot Lid",
  spout: "Teapot Spout",
  teapotspout: "Teapot Spout",
  bottom: "Teapot Spout",
  lanternbottom: "Teapot Spout",
  bottomlid: "Teapot Spout",
  lidbottom: "Teapot Spout",
  handle: "Teapot Handle",
  teapothandle: "Teapot Handle",
  tassel: "Teapot Handle",
  lanterntassel: "Teapot Handle",
  whole: "Whole Teapot",
  wholeteapot: "Whole Teapot"
};

const KERIS_COLOR_PARTS = {
  ...SHARED_COLOR_PARTS,
  body: "KERIS BODY",
  kerisbody: "KERIS BODY",
  blade: "KERIS BODY",
  lanternbody: "KERIS BODY",
  carving: "KERIS CARVING",
  keriscarving: "KERIS CARVING",
  bamboo: "KERIS CARVING",
  flower: "KERIS CARVING",
  handle: "KERIS HANDLE",
  kerishandle: "KERIS HANDLE",
  kerishandle1: "KERIS HANDLE",
  kerishandle2: "KERIS HANDLE",
  tassel: "KERIS HANDLE",
  lanterntassel: "KERIS HANDLE",
  whole: "Whole Keris",
  wholekeris: "Whole Keris"
};

const COLOR_PARTS = {
  lantern: LANTERN_COLOR_PARTS,
  teapot: TEAPOT_COLOR_PARTS,
  keris: KERIS_COLOR_PARTS
};

const KNOWN_COLOR_TOKENS = new Set([
  ...Object.keys(LANTERN_COLOR_PARTS),
  ...Object.keys(TEAPOT_COLOR_PARTS),
  ...Object.keys(KERIS_COLOR_PARTS)
]);

const LANTERN_SHAPES = [
  { part: "width", keys: ["width"] },
  { part: "height", keys: ["height"] },
  { part: "Lantern Top", keys: ["topLid"] },
  { part: "Lantern Bottom", keys: ["bottomLid"] },
  { part: "Lantern Tassel", keys: ["tassel"] },
  { part: "bamboo ribs", keys: ["bamboo"] },
  { part: "top cap", keys: ["topper"] },
  { part: "Lantern Bottom height", keys: ["bottom"] }
];

const TEAPOT_SHAPES = [
  { part: "width", keys: ["width"] },
  { part: "height", keys: ["height"] },
  { part: "Teapot Lid", keys: ["lid", "lidTop"], aliases: ["topLid"] },
  { part: "Teapot Spout", keys: ["spout", "lidBottom"], aliases: ["bottomLid"] },
  { part: "Teapot Handle", keys: ["handle"], aliases: ["tassel"] },
  { part: "middle", keys: ["middle"], aliases: ["bamboo"] },
  { part: "bevel", keys: ["bevel"], aliases: ["topper"] }
];

const KERIS_SHAPES = [
  { part: "width", keys: ["width"] },
  { part: "height", keys: ["height"] },
  { part: "sharpness", keys: ["sharpness"], aliases: ["topLid"] },
  { part: "curve", keys: ["curve"], aliases: ["bottomLid"] },
  { part: "KERIS CARVING", keys: ["carving"], aliases: ["bamboo"] },
  { part: "KERIS HANDLE", keys: ["handle", "kerisHandle1", "kerisHandle2"], aliases: ["tassel"] }
];

const SHAPES = {
  lantern: LANTERN_SHAPES,
  teapot: TEAPOT_SHAPES,
  keris: KERIS_SHAPES
};

const OPTION_FIELDS = {
  lantern: [
    ["topShape", "Lantern Top shape"],
    ["topType", "Lantern Top shape"],
    ["bottomShape", "Lantern Bottom shape"],
    ["bottomType", "Lantern Bottom shape"],
    ["tasselStyle", "Lantern Tassel"],
    ["tasselType", "Lantern Tassel"]
  ],
  teapot: [
    ["lidType", "Teapot Lid"],
    ["lidStyle", "Teapot Lid"],
    ["lidShape", "Teapot Lid"],
    ["spoutType", "Teapot Spout"],
    ["spoutStyle", "Teapot Spout"],
    ["spoutShape", "Teapot Spout"],
    ["handleType", "Teapot Handle"],
    ["handleStyle", "Teapot Handle"],
    ["handleShape", "Teapot Handle"]
  ],
  keris: [
    ["carvingType", "KERIS CARVING"],
    ["carvingStyle", "KERIS CARVING"],
    ["carvingShape", "KERIS CARVING"],
    ["handleType", "KERIS HANDLE"],
    ["handleStyle", "KERIS HANDLE"],
    ["handleShape", "KERIS HANDLE"]
  ]
};

const CRAFT_NOTES = {
  lantern:
    "Name only these parts: Lantern Body, Lantern Top, Lantern Bottom, Lantern Tassel. Do not call this a teapot or a keris.",
  teapot:
    "Name only these parts: Teapot Body, Teapot Lid, Teapot Spout, Teapot Handle. Shared sculpt fields are already translated (top lid = Teapot Lid, bottom lid = Teapot Spout, tassel = Teapot Handle, bamboo = middle, topper = bevel). Do not say tassel, bamboo, lantern top, or lantern bottom.",
  keris:
    "Name only these parts: KERIS BODY, KERIS CARVING, KERIS HANDLE. Shared sculpt fields are already translated (bamboo = KERIS CARVING, tassel and keris handles = KERIS HANDLE, top lid = sharpness, bottom lid = curve). Do not say tassel, lantern, or teapot parts."
};

function amountLabel(n) {
  if (n <= 17) return "barely changed";
  if (n <= 39) return "gentle";
  if (n <= 69) return "clear";
  return "bold";
}

function readNumber(source, key) {
  if (!source || typeof source !== "object") return null;
  if (typeof source[key] === "number" && Number.isFinite(source[key])) {
    return source[key];
  }
  const shapes = source.shapes || source.shape || source.shapeAmounts;
  if (shapes && typeof shapes[key] === "number" && Number.isFinite(shapes[key])) {
    return shapes[key];
  }
  return null;
}

function partToken(part) {
  return String(part).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function canonicalColorPart(part, tool) {
  if (!part) return null;
  const table = COLOR_PARTS[tool];
  if (!table) return part;
  const token = partToken(part);
  if (table[token]) return table[token];
  if (KNOWN_COLOR_TOKENS.has(token)) return null;
  return part;
}

function maxAmount(context, keys) {
  let best = null;
  for (const key of keys || []) {
    const value = readNumber(context, key);
    if (value == null) continue;
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    if (best == null || clamped > best) best = clamped;
  }
  return best;
}

function collectShapes(context, tool) {
  const fields = SHAPES[tool];
  if (!fields) return [];
  const shapes = [];

  for (const field of fields) {
    const native = maxAmount(context, field.keys);
    const value = native == null ? maxAmount(context, field.aliases) : native;
    if (value == null) continue;
    shapes.push({
      part: field.part,
      value,
      amount: amountLabel(value)
    });
  }

  return shapes;
}

function flag(context, key) {
  if (!context || typeof context[key] !== "boolean") return null;
  return context[key];
}

const FLAG_NAMES = {
  lantern: {
    hasStamp: "stamp",
    hasSelfie: "selfie",
    hasTassel: "Lantern Tassel",
    hasDesign: "design",
    hasBand: "band"
  },
  teapot: {
    hasStamp: "stamp",
    hasSelfie: "selfie",
    hasLid: "Teapot Lid",
    hasSpout: "Teapot Spout",
    hasHandle: "Teapot Handle",
    hasTassel: "Teapot Handle",
    hasDesign: "design",
    hasBand: "band"
  },
  keris: {
    hasStamp: "stamp",
    hasSelfie: "selfie",
    hasHandle: "KERIS HANDLE",
    hasTassel: "KERIS HANDLE",
    hasCarving: "KERIS CARVING",
    hasDesign: "design",
    hasBand: "band"
  }
};

const FLAG_KEYS = [
  "hasStamp",
  "hasSelfie",
  "hasHandle",
  "hasSpout",
  "hasLid",
  "hasTassel",
  "hasCarving",
  "hasDesign",
  "hasBand"
];

function readOption(source, key) {
  if (!source || typeof source !== "object") return null;
  const value = source[key] ?? source.shapes?.[key] ?? source.options?.[key];
  if (typeof value === "string" && value.trim() && value.length <= 40) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function collectOptions(context, tool) {
  const fields = OPTION_FIELDS[tool];
  if (!fields) return [];
  const byLabel = new Map();
  for (const [key, label] of fields) {
    const value = readOption(context, key);
    if (!value || byLabel.has(label)) continue;
    byLabel.set(label, { part: label, value });
  }
  return [...byLabel.values()];
}

function hasItems(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

export function buildSculptureFacts(sculptureData) {
  const context = sculptureData?.context && typeof sculptureData.context === "object"
    ? sculptureData.context
    : {};
  const tool = String(context.currentTool || "").trim().toLowerCase();
  const colors = [];
  const seen = new Set();
  walkColors(sculptureData, null, null, colors, seen);
  const namedColors = [];
  const namedSeen = new Set();
  for (const color of colors) {
    addColor(namedColors, namedSeen, {
      ...color,
      part: canonicalColorPart(color.part, tool)
    });
  }

  const present = [];
  const absent = [];
  const spokenFlags = new Map();
  for (const key of FLAG_KEYS) {
    const value = flag(context, key);
    const name = FLAG_NAMES[tool]?.[key];
    if (value == null || !name) continue;
    if (spokenFlags.get(name) === true) continue;
    spokenFlags.set(name, value);
  }
  for (const [name, value] of spokenFlags) {
    if (value) present.push(name);
    else absent.push(name);
  }
  if (hasItems(context.designs) && !present.includes("hasStamp")) present.push("designs");
  if (!hasItems(context.designs) && context.designs != null) absent.push("designs");
  if (hasItems(context.bands)) present.push("bands");
  else if (context.bands != null) absent.push("bands");
  if (hasItems(context.clayCoils)) present.push("clayCoils");
  else if (context.clayCoils != null) absent.push("clayCoils");
  if (hasItems(context.vertexSculpt)) present.push("vertexSculpt");
  else if (context.vertexSculpt != null) absent.push("vertexSculpt");

  return {
    tool: tool || null,
    stage: context.currentStage || null,
    craftSummary: typeof context.craftSummary === "string" ? context.craftSummary : null,
    colors: namedColors,
    shapes: collectShapes(context, tool),
    options: collectOptions(context, tool),
    present,
    absent
  };
}

export function formatSculptureFacts(facts) {
  const lines = ["VERIFIED SCULPTURE FACTS (these override any guess):"];

  if (facts.tool) lines.push(`Craft: ${facts.tool}.`);
  if (CRAFT_NOTES[facts.tool]) lines.push(CRAFT_NOTES[facts.tool]);
  if (facts.stage) lines.push(`Stage: ${facts.stage}.`);
  if (facts.craftSummary) lines.push(`Summary from the app: ${facts.craftSummary}`);

  if (facts.colors.length === 0) {
    lines.push("Colors: none recorded. Do not mention any color.");
  } else {
    lines.push("Colors (use these exact words, and only these):");
    for (const color of facts.colors) {
      if (color.part) {
        lines.push(`- ${color.part}: ${color.name} (${color.hex})`);
      } else {
        lines.push(`- palette color, part unknown: ${color.name} (${color.hex})`);
      }
    }
    lines.push(
      "Say the color word, not the hex code, unless the player asked for the code. " +
        "A part may be named only when that part is listed above. " +
        "A palette color with unknown part is the overall scheme only."
    );
  }

  if (facts.options?.length) {
    lines.push("Chosen part options:");
    for (const option of facts.options) {
      lines.push(`- ${option.part}: ${option.value}`);
    }
  }

  if (facts.shapes.length === 0) {
    lines.push("Shape amounts: none recorded. Do not describe specific proportions.");
  } else {
    lines.push("Shape amounts:");
    for (const shape of facts.shapes) {
      lines.push(`- ${shape.part}: ${shape.value}/100 (${shape.amount})`);
    }
    lines.push("Barely changed amounts are not a design choice. Do not praise them.");
  }

  lines.push(
    facts.present.length
      ? `Present: ${facts.present.join(", ")}.`
      : "Present extras: none recorded."
  );
  lines.push(
    facts.absent.length
      ? `Absent (do not mention): ${facts.absent.join(", ")}.`
      : "Absent list: nothing explicitly marked false."
  );

  return lines.join("\n");
}
