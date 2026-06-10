import type { StockCategory, StockItemType } from "@prisma/client";

export type StockClassificationInput = {
  name: string;
  category?: StockCategory | string | null;
  itemType?: StockItemType | string | null;
};

export type StockCategorySuggestion = {
  category: StockCategory;
  reason: string;
};

export function suggestStockCategory(item: StockClassificationInput): StockCategorySuggestion | null {
  const text = normalize(`${item.name}`);
  if (!text) return null;

  if (/\b(display\s*base|arm\s*display|arm\s*base|base\s*para\s*ipad)\b/.test(text)) {
    return suggestion("DISPLAY_BASE", "Name looks like a display or arm base.");
  }
  if (/\b(docking|dock|cradle|charger\s*bay|charging\s*bay)\b/.test(text)) {
    return suggestion("DOCK", "Name looks like a dock or charging bay.");
  }
  if (/\b(printhead|roller|platen|fuser|cutter)\b/.test(text)) {
    return suggestion("PRINTER_PART", "Name looks like a printer replacement part.");
  }
  if (/\b(zebra|ribbon|label|thermal\s*label|labels?)\b/.test(text) && !/\bcable\b/.test(text)) {
    return suggestion("PRINTER_SUPPLY", "Name looks like a printer supply.");
  }
  if (/\b(bateria|baterias|batería|baterías|battery|batteries)\b/.test(text)) {
    return suggestion("BATTERY", "Name looks like battery stock.");
  }
  if (/\b(keyboard|teclado)\b/.test(text)) return suggestion("KEYBOARD", "Name looks like keyboard stock.");
  if (/\b(mouse|mice)\b/.test(text)) return suggestion("MOUSE", "Name looks like mouse stock.");
  if (/\b(headset|audifono|audífono|auricular)\b/.test(text)) return suggestion("HEADSET", "Name looks like headset stock.");
  if (/\b(cable|mfi|lightning|usb|usb-c|usbc)\b/.test(text)) return suggestion("CABLE", "Name looks like cable stock.");
  if (/\b(charger|cargador|pd\s*fc|power\s*adapter|power\s*supply)\b/.test(text)) {
    return suggestion("CHARGER", "Name looks like charger stock.");
  }
  if (/\b(adapter|adaptador|dongle|hub)\b/.test(text)) return suggestion("ADAPTER", "Name looks like adapter stock.");
  if (/\b(protector|cover|case|top\s*cover|micas?)\b/.test(text)) return suggestion("ACCESSORY", "Name looks like an accessory.");
  return null;
}

export function stockNeedsCategoryReview(item: StockClassificationInput) {
  const suggestion = suggestStockCategory(item);
  return Boolean(suggestion && suggestion.category !== item.category);
}

export function filterStockItemsForList<T extends { active?: boolean | null }>(items: T[], showInactive = false) {
  return showInactive ? items : items.filter((item) => item.active !== false);
}

export function canIssueStockItemFromScan(item: { active?: boolean | null; quantityOnHand: number }) {
  return item.active !== false && item.quantityOnHand > 0;
}

function suggestion(category: StockCategory, reason: string): StockCategorySuggestion {
  return { category, reason };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
