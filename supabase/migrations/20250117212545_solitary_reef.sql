/*
  # Add wants_to_play_again column to players table

  1. Changes
    - Add `wants_to_play_again` boolean column to `players` table with default value of false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'wants_to_play_again'
  ) THEN
    ALTER TABLE players ADD COLUMN wants_to_play_again boolean DEFAULT false;
  END IF;
END $$;