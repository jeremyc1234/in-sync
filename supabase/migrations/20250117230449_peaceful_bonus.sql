/*
  # Add multiplayer support

  1. New Columns
    - `lobbies.max_players` (int) - Maximum number of players allowed (2-4)
    - `players.ready_to_start` (boolean) - Player ready status before game starts

  2. Changes
    - Add default values and constraints
    - Update existing rows
*/

-- Add max_players column to lobbies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lobbies' AND column_name = 'max_players'
  ) THEN
    ALTER TABLE lobbies ADD COLUMN max_players int DEFAULT 2 CHECK (max_players BETWEEN 2 AND 4);
  END IF;
END $$;

-- Add ready_to_start column to players
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'ready_to_start'
  ) THEN
    ALTER TABLE players ADD COLUMN ready_to_start boolean DEFAULT false;
  END IF;
END $$;