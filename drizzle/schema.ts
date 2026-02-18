import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, index, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Orders table - stores all customer orders
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 50 }).notNull(),
  comment: text("comment"),
  status: mysqlEnum("status", ["new", "processing", "completed", "cancelled"]).default("new").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  itemsCount: int("itemsCount").notNull(),
  source: mysqlEnum("source", ["website", "offline"]).default("website").notNull(),
  customerId: int("customerId").references(() => customers.id, { onDelete: "set null" }),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card", "transfer", "other"]).default("cash"),
  isLegalEntity: boolean("isLegalEntity").default(false),
  metadata: json("metadata").$type<{
    invoice?: {
      number: string;
      date: string;
      buyerName: string;
      buyerInn?: string;
      buyerKpp?: string;
      buyerAddress?: string;
      html: string;
    };
    act?: {
      number: string;
      date: string;
      html: string;
    };
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("status_idx").on(table.status),
  index("created_at_idx").on(table.createdAt),
  index("source_idx").on(table.source),
]);

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Order items table - stores individual items in each order
 */
export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productName: varchar("productName", { length: 255 }).notNull(),
  productArticle: varchar("productArticle", { length: 100 }).notNull(),
  productCategory: varchar("productCategory", { length: 100 }),
  quantity: int("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("order_id_idx").on(table.orderId),
  index("product_article_idx").on(table.productArticle),
]);

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * Contact requests table - stores contact form submissions
 */
export const contactRequests = mysqlTable("contactRequests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  message: text("message"),
  status: mysqlEnum("status", ["new", "processed"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("contact_status_idx").on(table.status),
  index("contact_created_at_idx").on(table.createdAt),
]);

export type ContactRequest = typeof contactRequests.$inferSelect;
export type InsertContactRequest = typeof contactRequests.$inferInsert;

/**
 * Site content table - stores editable text content for the website
 * Keys are unique identifiers like "home.hero.title", "home.hero.subtitle"
 */
export const siteContent = mysqlTable("siteContent", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  description: varchar("description", { length: 500 }),
  page: varchar("page", { length: 100 }).notNull(),
  section: varchar("section", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("content_page_idx").on(table.page),
  index("content_key_idx").on(table.key),
]);

export type SiteContent = typeof siteContent.$inferSelect;
export type InsertSiteContent = typeof siteContent.$inferInsert;

// ========== CRM MODULE ==========

/**
 * Customers table - unified customer database
 * Aggregates data from orders, contact requests, and telegram
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  telegramId: varchar("telegramId", { length: 100 }),
  telegramUsername: varchar("telegramUsername", { length: 100 }),
  source: mysqlEnum("source", ["website", "telegram", "phone", "referral", "other"]).default("website"),
  segment: mysqlEnum("segment", ["new", "regular", "vip", "inactive"]).default("new"),
  totalOrders: int("totalOrders").default(0),
  totalSpent: decimal("totalSpent", { precision: 12, scale: 2 }).default("0"),
  lastOrderAt: timestamp("lastOrderAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("customer_phone_idx").on(table.phone),
  index("customer_telegram_idx").on(table.telegramId),
  index("customer_segment_idx").on(table.segment),
]);

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Customer interactions - history of all contacts with customers
 */
export const customerInteractions = mysqlTable("customerInteractions", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["call", "message", "email", "order", "visit", "telegram", "ai_chat"]),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).default("inbound"),
  summary: text("summary"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("interaction_customer_idx").on(table.customerId),
  index("interaction_type_idx").on(table.type),
  index("interaction_created_idx").on(table.createdAt),
]);

export type CustomerInteraction = typeof customerInteractions.$inferSelect;
export type InsertCustomerInteraction = typeof customerInteractions.$inferInsert;

// ========== CATALOG MODULE ==========

/**
 * Products table - catalog of all products and services
 * Used for AI knowledge base and price management
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  article: varchar("article", { length: 100 }).notNull().unique(),
  sku: varchar("sku", { length: 50 }).unique(),
  barcode: varchar("barcode", { length: 100 }).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  priceMin: decimal("priceMin", { precision: 10, scale: 2 }),
  priceMax: decimal("priceMax", { precision: 10, scale: 2 }),
  priceUnit: varchar("priceUnit", { length: 50 }).default("шт"),
  materials: text("materials"),
  dimensions: varchar("dimensions", { length: 255 }),
  weight: varchar("weight", { length: 100 }),
  productionTime: varchar("productionTime", { length: 100 }),
  images: json("images").$type<string[]>(),
  isActive: boolean("isActive").default(true),
  stockStatus: mysqlEnum("stockStatus", ["in_stock", "to_order"]).default("in_stock"),
  stockQuantity: int("stockQuantity").default(0),
  minStockLevel: int("minStockLevel").default(0),
  tags: json("tags").$type<string[]>(),
  slug: varchar("slug", { length: 255 }).unique(),
  metaTitle: varchar("metaTitle", { length: 255 }),
  metaDescription: text("metaDescription"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("product_article_idx").on(table.article),
  index("product_category_idx").on(table.category),
  index("product_active_idx").on(table.isActive),
  index("product_slug_idx").on(table.slug),
]);

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Product categories - hierarchical categories for products
 */
export const productCategories = mysqlTable("productCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  parentId: int("parentId"),
  description: text("description"),
  image: varchar("image", { length: 500 }),
  sortOrder: int("sortOrder").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("category_slug_idx").on(table.slug),
  index("category_parent_idx").on(table.parentId),
]);

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = typeof productCategories.$inferInsert;

// ========== BUSINESS SETTINGS ==========

/**
 * Business settings - key-value store for business configuration
 * Examples: schedule.weekdays, contacts.phone, ai.system_prompt
 */
export const businessSettings = mysqlTable("businessSettings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  type: mysqlEnum("type", ["string", "number", "boolean", "json"]).default("string"),
  category: varchar("category", { length: 100 }),
  description: varchar("description", { length: 500 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("settings_key_idx").on(table.key),
  index("settings_category_idx").on(table.category),
]);

export type BusinessSetting = typeof businessSettings.$inferSelect;
export type InsertBusinessSetting = typeof businessSettings.$inferInsert;

// ========== FINANCE MODULE ==========

/**
 * Finance categories - categories for income and expenses
 */
export const financeCategories = mysqlTable("financeCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  color: varchar("color", { length: 20 }).default("#6B7280"),
  icon: varchar("icon", { length: 50 }),
  description: varchar("description", { length: 255 }),
  isSystem: boolean("isSystem").default(false),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("finance_category_type_idx").on(table.type),
  index("finance_category_active_idx").on(table.isActive),
]);

export type FinanceCategory = typeof financeCategories.$inferSelect;
export type InsertFinanceCategory = typeof financeCategories.$inferInsert;

/**
 * Finance accounts - cash registers, bank accounts, etc.
 */
export const financeAccounts = mysqlTable("financeAccounts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["cash", "bank", "other"]).default("cash").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0").notNull(),
  currency: varchar("currency", { length: 10 }).default("RUB").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("finance_account_active_idx").on(table.isActive),
]);

export type FinanceAccount = typeof financeAccounts.$inferSelect;
export type InsertFinanceAccount = typeof financeAccounts.$inferInsert;

/**
 * Transactions - all financial operations (income and expenses)
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  categoryId: int("categoryId").references(() => financeCategories.id, { onDelete: "set null" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  orderId: int("orderId").references(() => orders.id, { onDelete: "set null" }),
  customerId: int("customerId").references(() => customers.id, { onDelete: "set null" }),
  accountId: int("accountId").references(() => financeAccounts.id, { onDelete: "set null" }),
  date: timestamp("date").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card", "transfer", "other"]).default("cash"),
  isAutomatic: boolean("isAutomatic").default(false),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("transaction_type_idx").on(table.type),
  index("transaction_category_idx").on(table.categoryId),
  index("transaction_order_idx").on(table.orderId),
  index("transaction_account_idx").on(table.accountId),
  index("transaction_date_idx").on(table.date),
  index("transaction_created_idx").on(table.createdAt),
]);

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ========== WAREHOUSE MODULE ==========

/**
 * Stock movements - tracks arrivals and departures of inventory
 */
export const stockMovements = mysqlTable("stockMovements", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["arrival", "departure"]).notNull(),
  quantity: int("quantity").notNull(),
  reason: mysqlEnum("reason", ["purchase", "sale", "defect", "return", "correction", "other"]).default("purchase"),
  supplierName: varchar("supplierName", { length: 255 }),
  purchasePrice: decimal("purchasePrice", { precision: 10, scale: 2 }),
  note: text("note"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("stock_product_idx").on(table.productId),
  index("stock_type_idx").on(table.type),
  index("stock_date_idx").on(table.date),
]);

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = typeof stockMovements.$inferInsert;

// ========== CUSTOMER RATINGS ==========

/**
 * Customer ratings - staff rates customers after each sale
 */
export const customerRatings = mysqlTable("customerRatings", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").references(() => customers.id, { onDelete: "cascade" }),
  orderId: int("orderId").references(() => orders.id, { onDelete: "set null" }),
  rating: int("rating").notNull(), // 1-5
  tags: json("tags").$type<string[]>(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("cr_customer_idx").on(table.customerId),
  index("cr_order_idx").on(table.orderId),
]);

export type CustomerRating = typeof customerRatings.$inferSelect;
export type InsertCustomerRating = typeof customerRatings.$inferInsert;
