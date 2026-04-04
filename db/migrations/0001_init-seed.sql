INSERT OR IGNORE INTO organizations (name) VALUES
    ('新日本プロレス');
--> statement-breakpoint
INSERT OR IGNORE INTO titles (name, organization_id) VALUES
    ('IWGPヘビー級王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('IWGP世界ヘビー級王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('IWGP GLOBALヘビー級王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('IWGPジュニアヘビー級王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('NEVER無差別級王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('STRONG無差別級王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('NJPW WORLD認定TV王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('IWGP女子王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('STRONG女子王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('NEVER無差別級6人タッグ王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('IWGPタッグ王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('IWGPジュニアタッグ王座', (SELECT id FROM organizations WHERE name = '新日本プロレス')),
    ('STRONG無差別級タッグ王座', (SELECT id FROM organizations WHERE name = '新日本プロレス'));
