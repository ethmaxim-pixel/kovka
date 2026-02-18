#!/usr/bin/env python3
"""
Generate SQL for all products from image files
"""
import os
import re
from pathlib import Path

IMAGES_DIR = Path(__file__).parent.parent / "client" / "public" / "images"

# Category mapping: folder -> (display name, article prefix pattern)
CATEGORIES = {
    "balyasiny": ("Балясины", "SK50"),
    "cifry": ("Цифры и буквы", "SK"),
    "cvety": ("Цветы кованые", "SK"),
    "decor-elementy": ("Декоративные элементы", "SK"),
    "dekor-paneli": ("Декоративные панели", "SK"),
    "korzinki": ("Корзинки", "SK"),
    "listya": ("Листья кованые", "SK22"),
    "nakladki": ("Накладки", "SK"),
    "nakonechniki": ("Наконечники и навершия", "SK"),
    "osnovaniya": ("Основания балясин", "SK34"),
    "perekhody": ("Переходы на трубы", "SK"),
    "piki": ("Пики кованые", "SK30"),
    "plast-zaglushki": ("Пластиковые заглушки", "SK"),
    "pochtovye-yashiki": ("Почтовые ящики", "SK"),
    "polusfery": ("Полусферы", "SK01"),
    "poruchen": ("Поручни и окончания", "SK"),
    "ruchki": ("Ручки дверные", "SK"),
    "shary": ("Шары и сферы", "SK"),
    "stolby": ("Столбы начальные", "SK"),
    "venzelia": ("Вензеля и волюты", "SK"),
    "vinograd": ("Виноград", "SK"),
    "vstavki": ("Вставки в балясины", "SK"),
    "zaglushki": ("Заглушки и крышки", "SK"),
    "zaklepki": ("Заклёпки", "SK"),
}

def extract_article(filename):
    """Extract article from filename like SK50.01.1.jpg -> SK50.01.1"""
    name = Path(filename).stem
    # Remove L/R suffix if present
    name = re.sub(r'[LR]$', '', name)
    return name

def get_products():
    """Scan all image folders and generate product data"""
    products = {}  # article -> {category, images}

    for folder, (category_name, _) in CATEGORIES.items():
        folder_path = IMAGES_DIR / folder
        if not folder_path.exists():
            continue

        for img_file in folder_path.iterdir():
            if not img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                continue

            article = extract_article(img_file.name)
            # Each image = separate product (no grouping)
            base_article = article

            if base_article not in products:
                products[base_article] = {
                    'category': category_name,
                    'folder': folder,
                    'images': []
                }

            # Store relative image path
            img_path = f"/images/{folder}/{img_file.name}"
            if img_path not in products[base_article]['images']:
                products[base_article]['images'].append(img_path)

    return products

def generate_category_sql():
    """Generate SQL for categories"""
    sql_lines = ["-- Categories"]
    sql_lines.append("TRUNCATE TABLE productCategories;")

    for i, (slug, (name, _)) in enumerate(CATEGORIES.items(), 1):
        sql_lines.append(
            f"INSERT INTO productCategories (name, slug, sortOrder, isActive) "
            f"VALUES ('{name}', '{slug}', {i}, 1);"
        )

    return "\n".join(sql_lines)

def generate_products_sql(products):
    """Generate SQL for products"""
    sql_lines = ["-- Products"]
    sql_lines.append("TRUNCATE TABLE products;")

    for article, data in sorted(products.items()):
        category = data['category']
        images_json = str(data['images']).replace("'", '"')

        # Generate name from article
        name = f"{category} {article}"

        # Escape single quotes
        name_escaped = name.replace("'", "''")
        category_escaped = category.replace("'", "''")

        sql_lines.append(
            f"INSERT INTO products (article, name, category, images, isActive, stockStatus) "
            f"VALUES ('{article}', '{name_escaped}', '{category_escaped}', '{images_json}', 1, 'in_stock');"
        )

    return "\n".join(sql_lines)

def main():
    print("Scanning images...")
    products = get_products()
    print(f"Found {len(products)} unique products")

    # Generate SQL
    sql = []
    sql.append("SET NAMES utf8mb4;")
    sql.append("SET CHARACTER SET utf8mb4;")
    sql.append("")
    sql.append(generate_category_sql())
    sql.append("")
    sql.append(generate_products_sql(products))

    # Write to file
    output_file = Path(__file__).parent / "products_import.sql"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql))

    print(f"SQL written to {output_file}")
    print(f"Total: {len(CATEGORIES)} categories, {len(products)} products")

if __name__ == "__main__":
    main()
