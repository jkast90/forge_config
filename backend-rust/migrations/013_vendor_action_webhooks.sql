-- Add webhook/API call support to vendor actions
ALTER TABLE vendor_actions ADD COLUMN action_type TEXT NOT NULL DEFAULT 'ssh';
ALTER TABLE vendor_actions ADD COLUMN webhook_url TEXT NOT NULL DEFAULT '';
ALTER TABLE vendor_actions ADD COLUMN webhook_method TEXT NOT NULL DEFAULT 'POST';
ALTER TABLE vendor_actions ADD COLUMN webhook_headers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE vendor_actions ADD COLUMN webhook_body TEXT NOT NULL DEFAULT '';
