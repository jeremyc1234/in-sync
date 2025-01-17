/*
  # Game Schema Setup

  1. New Tables
    - `lobbies`
      - `code` (text, primary key) - Unique 5-character lobby code
      - `created_at` (timestamp)
      - `current_round` (int) - Current game round
      - `game_status` (text) - Status of the game (waiting, playing, finished)
      - `winner` (text) - Winner's nickname when game is finished
      - `rounds_taken` (int) - Number of rounds taken to win
    
    - `players`
      - `id` (uuid, primary key)
      - `lobby_code` (text) - References lobbies.code
      - `nickname` (text)
      - `current_word` (text) - Current word for the round
      - `ready` (boolean) - Player ready status
      
    - `words`
      - `id` (uuid, primary key)
      - `lobby_code` (text) - References lobbies.code
      - `player_id` (uuid) - References players.id
      - `word` (text)
      - `round` (int)
      
  2. Security
    - Enable RLS on all tables
    - Add policies for public access (since this is a public game)
*/

-- Create lobbies table
CREATE TABLE IF NOT EXISTS lobbies (
  code text PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  current_round int DEFAULT 1,
  game_status text DEFAULT 'waiting',
  winner text,
  rounds_taken int
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_code text REFERENCES lobbies(code) ON DELETE CASCADE,
  nickname text NOT NULL,
  current_word text,
  ready boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create words table
CREATE TABLE IF NOT EXISTS words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_code text REFERENCES lobbies(code) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  word text NOT NULL,
  round int NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to lobbies"
  ON lobbies FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to lobbies"
  ON lobbies FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to lobbies"
  ON lobbies FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to players"
  ON players FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to players"
  ON players FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to players"
  ON players FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to words"
  ON words FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to words"
  ON words FOR INSERT
  TO public
  WITH CHECK (true);