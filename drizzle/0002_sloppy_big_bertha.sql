CREATE TABLE `businessSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`type` enum('string','number','boolean','json') DEFAULT 'string',
	`category` varchar(100),
	`description` varchar(500),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `businessSettings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `customerInteractions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`type` enum('call','message','email','order','visit','telegram','ai_chat'),
	`direction` enum('inbound','outbound') DEFAULT 'inbound',
	`summary` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerInteractions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(50) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`telegramId` varchar(100),
	`telegramUsername` varchar(100),
	`source` enum('website','telegram','phone','referral','other') DEFAULT 'website',
	`segment` enum('new','regular','vip','inactive') DEFAULT 'new',
	`totalOrders` int DEFAULT 0,
	`totalSpent` decimal(12,2) DEFAULT '0',
	`lastOrderAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `financeCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`color` varchar(20) DEFAULT '#6B7280',
	`icon` varchar(50),
	`description` varchar(255),
	`isSystem` boolean DEFAULT false,
	`isActive` boolean DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financeCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`parentId` int,
	`description` text,
	`image` varchar(500),
	`sortOrder` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `productCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `productCategories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`article` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`subcategory` varchar(100),
	`priceMin` decimal(10,2),
	`priceMax` decimal(10,2),
	`priceUnit` varchar(50) DEFAULT 'шт',
	`materials` text,
	`dimensions` varchar(255),
	`weight` varchar(100),
	`productionTime` varchar(100),
	`images` json,
	`isActive` boolean DEFAULT true,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_article_unique` UNIQUE(`article`)
);
--> statement-breakpoint
CREATE TABLE `siteContent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`description` varchar(500),
	`page` varchar(100) NOT NULL,
	`section` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `siteContent_id` PRIMARY KEY(`id`),
	CONSTRAINT `siteContent_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`categoryId` int,
	`amount` decimal(12,2) NOT NULL,
	`description` text,
	`orderId` int,
	`customerId` int,
	`date` timestamp NOT NULL,
	`paymentMethod` enum('cash','card','transfer','other') DEFAULT 'cash',
	`isAutomatic` boolean DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customerInteractions` ADD CONSTRAINT `customerInteractions_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_categoryId_financeCategories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `financeCategories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `settings_key_idx` ON `businessSettings` (`key`);--> statement-breakpoint
CREATE INDEX `settings_category_idx` ON `businessSettings` (`category`);--> statement-breakpoint
CREATE INDEX `interaction_customer_idx` ON `customerInteractions` (`customerId`);--> statement-breakpoint
CREATE INDEX `interaction_type_idx` ON `customerInteractions` (`type`);--> statement-breakpoint
CREATE INDEX `interaction_created_idx` ON `customerInteractions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `customer_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `customer_telegram_idx` ON `customers` (`telegramId`);--> statement-breakpoint
CREATE INDEX `customer_segment_idx` ON `customers` (`segment`);--> statement-breakpoint
CREATE INDEX `finance_category_type_idx` ON `financeCategories` (`type`);--> statement-breakpoint
CREATE INDEX `finance_category_active_idx` ON `financeCategories` (`isActive`);--> statement-breakpoint
CREATE INDEX `category_slug_idx` ON `productCategories` (`slug`);--> statement-breakpoint
CREATE INDEX `category_parent_idx` ON `productCategories` (`parentId`);--> statement-breakpoint
CREATE INDEX `product_article_idx` ON `products` (`article`);--> statement-breakpoint
CREATE INDEX `product_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `product_active_idx` ON `products` (`isActive`);--> statement-breakpoint
CREATE INDEX `content_page_idx` ON `siteContent` (`page`);--> statement-breakpoint
CREATE INDEX `content_key_idx` ON `siteContent` (`key`);--> statement-breakpoint
CREATE INDEX `transaction_type_idx` ON `transactions` (`type`);--> statement-breakpoint
CREATE INDEX `transaction_category_idx` ON `transactions` (`categoryId`);--> statement-breakpoint
CREATE INDEX `transaction_order_idx` ON `transactions` (`orderId`);--> statement-breakpoint
CREATE INDEX `transaction_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transaction_created_idx` ON `transactions` (`createdAt`);--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `contact_status_idx` ON `contactRequests` (`status`);--> statement-breakpoint
CREATE INDEX `contact_created_at_idx` ON `contactRequests` (`createdAt`);--> statement-breakpoint
CREATE INDEX `order_id_idx` ON `orderItems` (`orderId`);--> statement-breakpoint
CREATE INDEX `product_article_idx` ON `orderItems` (`productArticle`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `orders` (`createdAt`);