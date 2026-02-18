CREATE TABLE `financeAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('cash','bank','other') NOT NULL DEFAULT 'cash',
	`balance` decimal(12,2) NOT NULL DEFAULT '0',
	`currency` varchar(10) NOT NULL DEFAULT 'RUB',
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financeAccounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stockMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`type` enum('arrival','departure') NOT NULL,
	`quantity` int NOT NULL,
	`reason` enum('purchase','sale','defect','return','correction','other') DEFAULT 'purchase',
	`supplierName` varchar(255),
	`purchasePrice` decimal(10,2),
	`note` text,
	`date` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `source` enum('website','offline') DEFAULT 'website' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `paymentMethod` enum('cash','card','transfer','other') DEFAULT 'cash';--> statement-breakpoint
ALTER TABLE `products` ADD `stockStatus` enum('in_stock','to_order') DEFAULT 'in_stock';--> statement-breakpoint
ALTER TABLE `products` ADD `stockQuantity` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `products` ADD `minStockLevel` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `transactions` ADD `accountId` int;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD CONSTRAINT `stockMovements_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `finance_account_active_idx` ON `financeAccounts` (`isActive`);--> statement-breakpoint
CREATE INDEX `stock_product_idx` ON `stockMovements` (`productId`);--> statement-breakpoint
CREATE INDEX `stock_type_idx` ON `stockMovements` (`type`);--> statement-breakpoint
CREATE INDEX `stock_date_idx` ON `stockMovements` (`date`);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_accountId_financeAccounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `financeAccounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `source_idx` ON `orders` (`source`);--> statement-breakpoint
CREATE INDEX `transaction_account_idx` ON `transactions` (`accountId`);