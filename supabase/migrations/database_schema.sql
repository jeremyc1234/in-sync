-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.lobbies (
  code text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  current_round integer DEFAULT 1,
  game_status text DEFAULT 'waiting'::text,
  winner text,
  rounds_taken integer,
  max_players integer DEFAULT 2 CHECK (max_players >= 2 AND max_players <= 4),
  new_lobby_code text,
  use_timer boolean DEFAULT false,
  round_limit integer,
  CONSTRAINT lobbies_pkey PRIMARY KEY (code)
);
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lobby_code text,
  nickname text NOT NULL,
  current_word text,
  ready boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  wants_to_play_again boolean DEFAULT false,
  ready_to_start boolean DEFAULT false,
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_lobby_code_fkey FOREIGN KEY (lobby_code) REFERENCES public.lobbies(code)
);
CREATE TABLE public.words (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lobby_code text,
  player_id uuid,
  word text NOT NULL,
  round integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT words_pkey PRIMARY KEY (id),
  CONSTRAINT words_lobby_code_fkey FOREIGN KEY (lobby_code) REFERENCES public.lobbies(code),
  CONSTRAINT words_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);