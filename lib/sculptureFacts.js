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

const SHAPE_FIELDS = [
  ["width", "width"],
  ["height", "height"],
  ["topLid", "top lid"],
  ["bottomLid", "bottom lid"],
  ["tassel", "tassel"],
  ["bamboo", "bamboo ribs"],
  ["topper", "top cap"],
  ["bottom", "base"],
  ["lid", "lid"],
  ["spout", "spout"],
  ["handle", "handle"],
  ["middle", "middle"],
  ["bevel", "bevel"],
  ["sharpness", "sharpness"],
  ["curve", "curve"],
  ["carving", "carving"],
  ["kerisHandle1", "handle"],
  ["kerisHandle2", "handle"],
  ["lidTop", "lid"],
  ["lidBottom", "spout"]
];

const TEAPOT_ALIAS = {
  bamboo: "middle",
  topper: "bevel",
  lidTop: "lid",
  lidBottom: "spout",
  tassel: "handle"
};

const KERIS_ALIAS = {
  bamboo: "carving"
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

function collectShapes(context, tool) {
  const alias = tool === "teapot" ? TEAPOT_ALIAS : tool === "keris" ? KERIS_ALIAS : {};
  const byLabel = new Map();

  for (const [key, label] of SHAPE_FIELDS) {
    const value = readNumber(context, key);
    if (value == null) continue;
    const spoken = alias[key] || label;
    const clamped = Math.max(0, Math.min(100, value));
    const existing = byLabel.get(spoken);
    if (!existing || clamped > existing.value) {
      byLabel.set(spoken, { part: spoken, value: Math.round(clamped) });
    }
  }

  return [...byLabel.values()].map((item) => ({
    ...item,
    amount: amountLabel(item.value)
  }));
}

function flag(context, key) {
  if (!context || typeof context[key] !== "boolean") return null;
  return context[key];
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
  const tool = String(context.currentTool || "").toLowerCase();
  const colors = [];
  const seen = new Set();
  walkColors(sculptureData, null, null, colors, seen);

  const present = [];
  const absent = [];
  for (const key of [
    "hasStamp",
    "hasSelfie",
    "hasHandle",
    "hasSpout",
    "hasLid",
    "hasTassel",
    "hasCarving",
    "hasDesign",
    "hasBand"
  ]) {
    const value = flag(context, key);
    if (value === true) present.push(key);
    if (value === false) absent.push(key);
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
    colors,
    shapes: collectShapes(context, tool),
    present,
    absent
  };
}

export function formatSculptureFacts(facts) {
  const lines = ["VERIFIED SCULPTURE FACTS (these override any guess):"];

  if (facts.tool) lines.push(`Craft: ${facts.tool}.`);
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
