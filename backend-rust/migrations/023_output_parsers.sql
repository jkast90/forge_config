-- Output parsers for parsing command/action output using regex
CREATE TABLE IF NOT EXISTS output_parsers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    pattern TEXT NOT NULL DEFAULT '',
    extract_names TEXT NOT NULL DEFAULT '',
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Link vendor actions to output parsers
ALTER TABLE vendor_actions ADD COLUMN output_parser_id INTEGER DEFAULT NULL;
