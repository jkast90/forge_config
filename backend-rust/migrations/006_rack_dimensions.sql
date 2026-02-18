-- Add physical dimensions to racks for fiber/cable length calculations
ALTER TABLE ipam_racks ADD COLUMN width_cm INTEGER DEFAULT 60;
ALTER TABLE ipam_racks ADD COLUMN height_ru INTEGER DEFAULT 42;
ALTER TABLE ipam_racks ADD COLUMN depth_cm INTEGER DEFAULT 100;
