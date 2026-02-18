import mysql from "mysql2/promise";

const DB_URL = "mysql://kovka:kovka2025@localhost:3306/kovka";

// Category tree definition
const CATEGORY_TREE = [
  {
    name: "Кованные элементы",
    slug: "kovanye-elementy",
    sortOrder: 1,
    children: [
      "Балясины", "Вензеля и волюты", "Кованый виноград", "Вставки в балясины",
      "Декоративные панели", "Заглушки и крышки", "Корзинки", "Листья кованые",
      "Наконечники и навершия", "Основания балясин", "Пики кованые", "Полусферы",
      "Поручни и окончания", "Розетки", "Заклёпки", "Ручки дверные",
      "Цветы кованые", "Шары и сферы", "Эксклюзивная ковка",
      "Колпаки и переходы", "Декоративные элементы", "Декор полосы", "Цифры",
      "Ложные завесы", "Кронштейн", "Накладки", "Столбы начальные",
      "Пластиковые заглушки", "Переходы на трубы", "Ящики почтовые",
      "Штампованные элементы", "Литые элементы", "Кольца и квадраты",
      "Декоративные панели", "Столбы и трубы",
    ],
  },
  {
    name: "Краски, патина",
    slug: "kraski-patina",
    sortOrder: 2,
    children: ["Кузнечные краски", "Патина"],
  },
  {
    name: "Художественный прокат",
    slug: "hudozhestvennyj-prokat",
    sortOrder: 3,
    children: [
      "Виноградная лоза", "Квадрат", "Обжимная полоса",
      "Декоративная полоса", "Труба витая", "Труба декоративная",
    ],
  },
  {
    name: "Металлопрокат",
    slug: "metalloprokat",
    sortOrder: 4,
    children: [
      "Арматура", "Круг стальной", "Стальные трубы", "Квадрат стальной",
      "Стальные листы", "Уголок стальной", "Стальная полоса",
      "Балка и двутавр", "Швеллер и п-профиль", "Шестигранник",
      "Конструкционные", "Сталь с покрытием",
    ],
  },
  {
    name: "Сопутствующие товары",
    slug: "soputstvuyushchie-tovary",
    sortOrder: 5,
    children: [
      "Крепление ограждений", "Отрезные диски", "Перчатки",
      "Петли", "Сварочные материалы",
    ],
  },
];

// Mapping of OLD category names in DB → { mainCategory, subcategoryName }
const CATEGORY_MAPPING: Record<string, { main: string; sub: string }> = {
  // Кованные элементы
  "Балясины": { main: "Кованные элементы", sub: "Балясины" },
  "Вензеля и волюты": { main: "Кованные элементы", sub: "Вензеля и волюты" },
  "Кованый виноград": { main: "Кованные элементы", sub: "Кованый виноград" },
  "Виноград": { main: "Кованные элементы", sub: "Кованый виноград" },
  "Вставки в балясины": { main: "Кованные элементы", sub: "Вставки в балясины" },
  "Декоративные панели": { main: "Кованные элементы", sub: "Декоративные панели" },
  "Заглушки, крышки": { main: "Кованные элементы", sub: "Заглушки и крышки" },
  "Корзинки": { main: "Кованные элементы", sub: "Корзинки" },
  "Листья кованые": { main: "Кованные элементы", sub: "Листья кованые" },
  "Листья": { main: "Кованные элементы", sub: "Листья кованые" },
  "Наконечники, навершия": { main: "Кованные элементы", sub: "Наконечники и навершия" },
  "Навершия": { main: "Кованные элементы", sub: "Наконечники и навершия" },
  "Основания балясин": { main: "Кованные элементы", sub: "Основания балясин" },
  "Основания": { main: "Кованные элементы", sub: "Основания балясин" },
  "Пики кованые": { main: "Кованные элементы", sub: "Пики кованые" },
  "Пики": { main: "Кованные элементы", sub: "Пики кованые" },
  "Полусферы": { main: "Кованные элементы", sub: "Полусферы" },
  "Поручень, окончание поручня": { main: "Кованные элементы", sub: "Поручни и окончания" },
  "Поручни": { main: "Кованные элементы", sub: "Поручни и окончания" },
  "Розетки": { main: "Кованные элементы", sub: "Розетки" },
  "Заклёпки": { main: "Кованные элементы", sub: "Заклёпки" },
  "Ручки дверные": { main: "Кованные элементы", sub: "Ручки дверные" },
  "Цветы кованые": { main: "Кованные элементы", sub: "Цветы кованые" },
  "Цветы": { main: "Кованные элементы", sub: "Цветы кованые" },
  "Шары кованые, сферы": { main: "Кованные элементы", sub: "Шары и сферы" },
  "Колпаки и переходы": { main: "Кованные элементы", sub: "Колпаки и переходы" },
  "Декоративные элементы": { main: "Кованные элементы", sub: "Декоративные элементы" },
  "Декор полосы": { main: "Кованные элементы", sub: "Декор полосы" },
  "Цифры": { main: "Кованные элементы", sub: "Цифры" },
  "Накладки": { main: "Кованные элементы", sub: "Накладки" },
  "Столбы начальные": { main: "Кованные элементы", sub: "Столбы начальные" },
  "Пластиковые заглушки": { main: "Кованные элементы", sub: "Пластиковые заглушки" },
  "Переходы на трубы": { main: "Кованные элементы", sub: "Переходы на трубы" },
  "Ящики почтовые": { main: "Кованные элементы", sub: "Ящики почтовые" },
  "Штампованные элементы": { main: "Кованные элементы", sub: "Штампованные элементы" },
  "Литые элементы": { main: "Кованные элементы", sub: "Литые элементы" },
  "Кольца и квадраты": { main: "Кованные элементы", sub: "Кольца и квадраты" },
  "Столбы и трубы": { main: "Кованные элементы", sub: "Столбы и трубы" },
  // Краски, патина
  "Краски, патина": { main: "Краски, патина", sub: "Кузнечные краски" },
  // Художественный прокат
  "Художественный прокат": { main: "Художественный прокат", sub: "Художественный прокат" },
};

function slugify(text: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
    з: "z", и: "i", й: "j", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
    ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return text
    .toLowerCase()
    .split("")
    .map((c) => map[c] || c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log("Connected to database\n");

  // Step 1: Clear and populate productCategories
  console.log("=== Step 1: Populating productCategories table ===");
  await conn.execute("DELETE FROM productCategories");

  for (const cat of CATEGORY_TREE) {
    const [result] = await conn.execute(
      "INSERT INTO productCategories (name, slug, parentId, sortOrder, isActive, createdAt) VALUES (?, ?, NULL, ?, 1, NOW())",
      [cat.name, cat.slug, cat.sortOrder]
    );
    const parentId = (result as any).insertId;
    console.log(`  + ${cat.name} (id=${parentId})`);

    // Deduplicate children
    const uniqueChildren = [...new Set(cat.children)];
    for (let i = 0; i < uniqueChildren.length; i++) {
      const child = uniqueChildren[i];
      const childSlug = slugify(child);
      await conn.execute(
        "INSERT INTO productCategories (name, slug, parentId, sortOrder, isActive, createdAt) VALUES (?, ?, ?, ?, 1, NOW())",
        [child, childSlug, parentId, i + 1]
      );
    }
    console.log(`    → ${uniqueChildren.length} subcategories`);
  }

  // Step 2: Remap products
  console.log("\n=== Step 2: Remapping product categories ===");
  const [products] = await conn.execute(
    "SELECT id, category, subcategory FROM products WHERE category IS NOT NULL"
  ) as any[];

  let updated = 0;
  let unmapped = 0;
  const unmappedCategories = new Set<string>();

  for (const product of products) {
    const mapping = CATEGORY_MAPPING[product.category];
    if (mapping) {
      await conn.execute(
        "UPDATE products SET category = ?, subcategory = ? WHERE id = ?",
        [mapping.main, mapping.sub, product.id]
      );
      updated++;
    } else {
      unmapped++;
      unmappedCategories.add(product.category);
    }
  }

  console.log(`\n  Updated: ${updated} products`);
  console.log(`  Unmapped: ${unmapped} products`);
  if (unmappedCategories.size > 0) {
    console.log(`  Unmapped categories: ${[...unmappedCategories].join(", ")}`);
  }

  // Step 3: Summary
  console.log("\n=== Summary ===");
  const [cats] = await conn.execute(
    "SELECT category, subcategory, COUNT(*) as cnt FROM products WHERE category IS NOT NULL GROUP BY category, subcategory ORDER BY category, subcategory"
  ) as any[];
  for (const row of cats) {
    console.log(`  ${row.category} / ${row.subcategory || "(нет)"}: ${row.cnt} товаров`);
  }

  await conn.end();
  console.log("\nDone!");
}

main().catch(console.error);
