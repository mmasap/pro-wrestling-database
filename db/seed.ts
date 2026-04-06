import { sql } from "drizzle-orm";
import { db } from "./index";
import { organizations, titles, units } from "./schema";

await db.insert(organizations).values([
	{ id: "njpw", name: "新日本プロレス" },
	{ id: "aew", name: "AEW" },
	{ id: "cmll", name: "CMLL" },
	{ id: "ddt", name: "DDTプロレスリング" },
	{ id: "noah", name: "プロレスリング・ノア" },
	{ id: "ajpw", name: "全日本プロレス" },
	{ id: "jto", name: "JTO" },
]).onConflictDoNothing();

await db.insert(titles).values([
	{ id: "iwgp",                       organizationId: "njpw", name: "IWGPヘビー級王座",             displayOrder: 1 },
	{ id: "iwgp-global-heavyweight",    organizationId: "njpw", name: "IWGP GLOBALヘビー級王座",      displayOrder: 2 },
	{ id: "iwgp-jr",                    organizationId: "njpw", name: "IWGPジュニアヘビー級王座",     displayOrder: 3 },
	{ id: "never",                      organizationId: "njpw", name: "NEVER 無差別級王座",           displayOrder: 4 },
	{ id: "strong-openweight",          organizationId: "njpw", name: "STRONG無差別級王座",           displayOrder: 5 },
	{ id: "njpwworld-tv",               organizationId: "njpw", name: "NJPW WORLD認定TV王座",         displayOrder: 6 },
	{ id: "iwgp-2tag",                  organizationId: "njpw", name: "IWGPタッグ王座",               displayOrder: 7 },
	{ id: "iwgp-jr-2tag",               organizationId: "njpw", name: "IWGPジュニアタッグ王座",       displayOrder: 8 },
	{ id: "strong-openweight-tag-team", organizationId: "njpw", name: "STRONG無差別級タッグ王座",     displayOrder: 9 },
	{ id: "never-6tag",                 organizationId: "njpw", name: "NEVER無差別級6人タッグ王座",   displayOrder: 10 },
	{ id: "iwgp-world-heavyweight",     organizationId: "njpw", name: "IWGP世界ヘビー級王座",         displayOrder: 11 },
	{ id: "inter-continental",          organizationId: "njpw", name: "IWGPインターコンチネンタル王座", displayOrder: 12 },
	{ id: "iwgpus",                     organizationId: "njpw", name: "USヘビー級王座",               displayOrder: 13 },
	{ id: "iwgp-womens",                organizationId: "njpw", name: "IWGP女子王座" },
	{ id: "strong-womens",              organizationId: "njpw", name: "STRONG女子王座" },
]).onConflictDoUpdate({
	target: titles.id,
	set: { displayOrder: sql`excluded.display_order` },
});

await db.insert(units).values([
	{ id: "njpw",         organizationId: "njpw", name: "新日本プロレス" },
	{ id: "main_force",   organizationId: "njpw", name: "本隊" },
	{ id: "united-empire",organizationId: "njpw", name: "UNITED EMPIRE" },
	{ id: "hot",          organizationId: "njpw", name: "HOUSE OF TORTURE" },
	{ id: "tmdk",         organizationId: "njpw", name: "TMDK" },
	{ id: "unbound-co",   organizationId: "njpw", name: "Unbound Co." },
	{ id: "jto",          organizationId: "jto",  name: "JTO" },
	{ id: "aew",          organizationId: "aew",  name: "AEW" },
	{ id: "cmll",         organizationId: "cmll", name: "CMLL" },
	{ id: "ddt",          organizationId: "ddt",  name: "DDTプロレス" },
]).onConflictDoNothing();

console.log("Seed completed.");
