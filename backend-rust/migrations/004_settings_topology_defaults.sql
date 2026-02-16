-- Add topology builder default model settings
-- Settings are stored as JSON; add new keys with null defaults if missing
UPDATE settings SET data = json_set(
    data,
    '$.default_spine_model', json_extract(data, '$.default_spine_model'),
    '$.default_leaf_model', json_extract(data, '$.default_leaf_model'),
    '$.default_mgmt_switch_model', json_extract(data, '$.default_mgmt_switch_model'),
    '$.default_gpu_model', json_extract(data, '$.default_gpu_model')
)
WHERE id = 1
  AND json_extract(data, '$.default_spine_model') IS NULL;
