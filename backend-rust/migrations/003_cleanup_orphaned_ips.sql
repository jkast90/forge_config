-- Clean up orphaned IP addresses where device has been deleted
-- (device_id was SET NULL by previous FK behavior instead of CASCADE)
DELETE FROM ipam_ip_addresses WHERE device_id IS NULL AND description != '';
