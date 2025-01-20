import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Confetti from './Confetti';

/** Helper to generate a random 5-character lobby code. */
function generateLobbyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface GameProps {
  lobbyCode: string;
  playerId: string;
  nickname: string;
  onExit: () => void;
  /** Add this so we can automatically jump to the new lobby once created. */
  onJoin?: (newLobbyCode: string, newPlayerId: string, nickname: string) => void;
}

interface Player {
  id: string;
  nickname: string;
  current_word: string | null;
  ready: boolean;
  ready_to_start: boolean;
  wants_to_play_again: boolean; // <-- NEW: Track who wants to play again
}

interface Word {
  word: string;
  player_id: string;
  round: number;
}

export default function Game({
  lobbyCode,
  playerId,
  nickname,
  onExit,
  onJoin, // <-- optional, if you want automatic rejoin
}: GameProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [gameStatus, setGameStatus] = useState<'waiting' | 'ready' | 'playing' | 'finished'>('waiting');
  const [currentRound, setCurrentRound] = useState(1);
  const [roundWords, setRoundWords] = useState<Word[]>([]);
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [playerLeft, setPlayerLeft] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [shareButtonText, setShareButtonText] = useState('Share your score with your friends!');


  // ---------------------------------------------------------
  // 1) INITIAL DATA FETCH
  // ---------------------------------------------------------
  useEffect(() => {
    const fetchInitialData = async () => {
      const [playersData, lobbyData, wordsData] = await Promise.all([
        supabase.from('players').select('*').eq('lobby_code', lobbyCode),
        supabase.from('lobbies').select('*').eq('code', lobbyCode).single(),
        supabase.from('words').select('*').eq('lobby_code', lobbyCode).order('round', { ascending: true }),
      ]);

      if (playersData.data) setPlayers(playersData.data);

      if (lobbyData.data) {
        setGameStatus(lobbyData.data.game_status);
        setCurrentRound(lobbyData.data.current_round);
        setWinner(lobbyData.data.winner);
        setMaxPlayers(lobbyData.data.max_players);
      }

      if (wordsData.data) {
        setAllWords(wordsData.data);
        const currentRoundWords = wordsData.data.filter(
          (w) => w.round === (lobbyData.data?.current_round || 1)
        );
        setRoundWords(currentRoundWords);
      }
    };

    fetchInitialData();
  }, [lobbyCode]);

  // ---------------------------------------------------------
  // 2) REAL-TIME SUBSCRIPTIONS
  // ---------------------------------------------------------
  useEffect(() => {
    // Players subscription
    const playersSubscription = supabase
      .channel('game-players')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `lobby_code=eq.${lobbyCode}`,
        },
        async (payload) => {
          // Re-fetch the latest players
          const { data: updatedPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('lobby_code', lobbyCode);

          if (updatedPlayers) {
            // Detect if someone left (length decreased)
            if (updatedPlayers.length < players.length) {
              setPlayerLeft(true);
              toast.error('A player has left the game');
            }
            setPlayers(updatedPlayers);

            // Check if the game is finished and no new lobby is created yet
            const { data: lobbyRes } = await supabase
              .from('lobbies')
              .select('game_status, new_lobby_code')
              .eq('code', lobbyCode)
              .single();
            if (
              lobbyRes?.game_status === 'waiting' &&
              updatedPlayers.length == maxPlayers &&
              updatedPlayers.every((p) => p.ready_to_start)
            ) {
              await supabase
                .from('lobbies')
                .update({ game_status: 'playing' })
                .eq('code', lobbyCode);
              console.log('All players are ready. Game set to "playing"!');
            }
            if (
              lobbyRes?.game_status === 'finished' &&
              !lobbyRes.new_lobby_code && // new lobby not created yet
              updatedPlayers.length > 0 &&
              updatedPlayers.every((p) => p.wants_to_play_again)
            ) {
              toast.success('All players want to play again! Creating new lobby...');
              await createNewLobbyForEveryone();
            }
          }
        }
      )
      .subscribe();

    // Lobby subscription
    const lobbySubscription = supabase
      .channel('game-lobby')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobbies',
          filter: `code=eq.${lobbyCode}`,
        },
        async (payload) => {
          console.log('Lobby updated:', payload);
          setGameStatus(payload.new.game_status);
          setCurrentRound(payload.new.current_round);
          if (payload.new.winner) {
            setWinner(payload.new.winner);
          }

          // If new_lobby_code is set => the new lobby was just created
          if (payload.new.new_lobby_code && onJoin) {
            const newCode = payload.new.new_lobby_code as string;

            // Wait briefly for the new players to be inserted
            setTimeout(async () => {
              // Find our new player record by matching nickname
              const { data: found } = await supabase
                .from('players')
                .select('id')
                .eq('lobby_code', newCode)
                .eq('nickname', nickname)
                .single();

              if (found?.id) {
                onJoin(newCode, found.id, nickname);
              } else {
                toast.error('Could not find your player record in the new lobby!');
              }
            }, 300);
          }
        }
      )
      .subscribe();

    // Words subscription
    const wordsSubscription = supabase
      .channel('game-words')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'words',
          filter: `lobby_code=eq.${lobbyCode}`,
        },
        async () => {
          const { data } = await supabase
            .from('words')
            .select('*')
            .eq('lobby_code', lobbyCode)
            .order('round', { ascending: true });

          if (data) {
            console.log('Words updated:', data);
            setAllWords(data);
            const currentRoundWords = data.filter((w) => w.round === currentRound);
            setRoundWords(currentRoundWords);

            // Check if all players submitted in this round
            if (currentRoundWords.length === players.length) {
              // check if all words match
              const allWordsMatch = currentRoundWords.every(
                (w) =>
                  w.word.toLowerCase() === currentRoundWords[0].word.toLowerCase()
              );

              if (allWordsMatch) {
                // Mark game finished
                await supabase
                  .from('lobbies')
                  .update({
                    game_status: 'finished',
                    winner: nickname,
                    rounds_taken: currentRound,
                  })
                  .eq('code', lobbyCode);
              } else {
                // Proceed to next round
                await supabase
                  .from('lobbies')
                  .update({
                    current_round: currentRound + 1,
                  })
                  .eq('code', lobbyCode);

                // Reset player ready states
                await supabase
                  .from('players')
                  .update({ ready: false, current_word: null })
                  .eq('lobby_code', lobbyCode);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      playersSubscription.unsubscribe();
      lobbySubscription.unsubscribe();
      wordsSubscription.unsubscribe();
    };
  }, [lobbyCode, currentRound, players.length, nickname, onJoin]);

  // ---------------------------------------------------------
  // CREATE NEW LOBBY FOR EVERYONE (called once all have pressed play again)
  // ---------------------------------------------------------
  async function createNewLobbyForEveryone() {
    try {
      // 1) Fetch old lobby for max_players
      const { data: oldLobby } = await supabase
        .from('lobbies')
        .select('max_players')
        .eq('code', lobbyCode)
        .single();

      if (!oldLobby) {
        toast.error('Old lobby not found.');
        return;
      }

      // 2) Generate a brand-new code
      const newLobbyCode = generateLobbyCode();

      // 3) Create the new lobby
      const { error: lobbyError } = await supabase
        .from('lobbies')
        .insert([
          { code: newLobbyCode, max_players: oldLobby.max_players },
        ]);
      if (lobbyError) throw lobbyError;

      // 4) Insert all existing players (same nicknames) into the new lobby
      const newPlayers = players.map((p) => ({
        lobby_code: newLobbyCode,
        nickname: p.nickname,
      }));

      const { error: insertError } = await supabase
        .from('players')
        .insert(newPlayers);
      if (insertError) throw insertError;

      // 5) Update the old lobby’s new_lobby_code so all clients see it
      const { error: updateError } = await supabase
        .from('lobbies')
        .update({ new_lobby_code: newLobbyCode })
        .eq('code', lobbyCode);

      if (updateError) throw updateError;

      console.log('Created new lobby for everyone:', newLobbyCode);
    } catch (error) {
      console.error('Error creating new lobby for everyone:', error);
      toast.error('Failed to create new lobby');
    }
  }

  // ---------------------------------------------------------
  // SHARE LOBBY
  // ---------------------------------------------------------

  function handleShareLobby() {
    try {
      const message = `Join my Word Synced lobby! Use the code ${lobbyCode}.\n\nhttps://wordsynced.com/?utm_source=join_lobby&utm_medium=text_message`;
      const encodedMessage = encodeURIComponent(message);

      // This opens the default SMS app (works on most mobile devices).
      // On desktop browsers, it may do nothing or prompt to select an app.
      window.location.href = `sms:?body=${encodedMessage}`;
    } catch (error) {
      console.error('Failed to share via SMS:', error);
      toast.error('Failed to open SMS');
    }
  }

  // ---------------------------------------------------------
  // UTILITY: format a list of names with commas and "and"
  // ---------------------------------------------------------
  function formatPlayerNames(names: string[]) {
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return names.join(' and ');
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  // ---------------------------------------------------------
  // SHARE SCORE
  // ---------------------------------------------------------
  async function handleShareScore() {
    try {
      // 1) Build your share message
      const finalRoundWords = allWords.filter((w) => w.round === currentRound);
      const finalWord = finalRoundWords[0]?.word ?? '(unknown)';
      const names = players.map((p) => p.nickname);
      const roundOneWords = allWords.filter((w) => w.round === 1).map((w) => w.word);

      const shareMessage = `
  Word Synced: ${formatPlayerNames(names)} guessed the same word "${finalWord}" in ${currentRound} rounds! 🎉
  
They started with the words ${formatPlayerNames(roundOneWords)}.
  
Try to beat us ➡️ https://wordsynced.com?utm_source=share_score&utm_medium=text_message
      `.trim();

      // 2) Encode the message to safely include spaces, punctuation, etc.
      const encodedMessage = encodeURIComponent(shareMessage);

      // 3) Open the default SMS app. 
      //    This typically works on iOS/Android and will open iMessage on iOS.
      window.location.href = `sms:?body=${encodedMessage}`;
    } catch (error) {
      console.error('Failed to share via SMS:', error);
      toast.error('Failed to open SMS');
    }
  }
  // ---------------------------------------------------------
  // READY TO START
  // ---------------------------------------------------------
  const handleReadyToStart = async () => {
    try {
      await supabase
        .from('players')
        .update({ ready_to_start: true })
        .eq('id', playerId);
    } catch (error) {
      console.error('Error setting ready status:', error);
      toast.error('Failed to set ready status');
    }
  };

  // ---------------------------------------------------------
  // SUBMIT WORD
  // ---------------------------------------------------------
  const submitWord = async () => {
    if (!currentWord.trim()) {
      toast.error('Please enter a word');
      return;
    }

    const normalizedWord = currentWord.toLowerCase().trim();

    // Check if used in previous rounds
    const wordUsedInPreviousRounds = allWords.some(
      (w) => w.round < currentRound && w.word.toLowerCase() === normalizedWord
    );
    if (wordUsedInPreviousRounds) {
      toast.error('This word has been used in a previous round. Try a different word!');
      return;
    }

    try {
      await supabase.from('words').insert([
        {
          lobby_code: lobbyCode,
          player_id: playerId,
          word: normalizedWord,
          round: currentRound,
        },
      ]);

      // Update player's submitted word/ready
      await supabase
        .from('players')
        .update({ current_word: currentWord, ready: true })
        .eq('id', playerId);

      setCurrentWord('');
    } catch (error) {
      console.error('Error submitting word:', error);
      toast.error('Failed to submit word');
    }
  };

  // ---------------------------------------------------------
  // EXIT LOBBY
  // ---------------------------------------------------------
  const handleExit = async () => {
    try {
      await supabase.from('players').delete().eq('id', playerId);
      onExit();
    } catch (error) {
      console.error('Error leaving game:', error);
      toast.error('Failed to leave game');
    }
  };

  // ---------------------------------------------------------
  // REQUEST PLAY AGAIN (just sets wants_to_play_again = true)
  // ---------------------------------------------------------
  const handlePlayAgain = async () => {
    try {
      await supabase
        .from('players')
        .update({ wants_to_play_again: true })
        .eq('id', playerId);

      toast('Waiting for everyone else to press Play Again...');
    } catch (error) {
      console.error('Error requesting play again:', error);
      toast.error('Failed to request play again');
    }
  };

  // ---------------------------------------------------------
  // CREATE A BRAND-NEW LOBBY (MANUAL BUTTON IF PLAYER LEFT)
  // ---------------------------------------------------------
  const handleCreateNewLobby = async () => {
    try {
      // We’ll reuse your existing "handleExit" logic to go back to menu
      await handleExit();
      onExit();
    } catch (error) {
      console.error('Error creating new lobby:', error);
      toast.error('Failed to create new lobby');
    }
  };

  // ---------------------------------------------------------
  // GET CURRENT PLAYER / DERIVED STATES
  // ---------------------------------------------------------
  const currentPlayer = players.find((p) => p.id === playerId);
  const isReady = currentPlayer?.ready;
  const isReadyToStart = currentPlayer?.ready_to_start;
  const allPlayersPresent = players.length === maxPlayers;
  const allPlayersSubmitted = roundWords.length === players.length;

  // ---------------------------------------------------------
  // RENDER WORD HISTORY
  // ---------------------------------------------------------
  const renderWordHistory = () => {
    const groupedWords = allWords.reduce<Record<number, Word[]>>((acc, word) => {
      if (!acc[word.round]) acc[word.round] = [];
      acc[word.round].push(word);
      return acc;
    }, {});

    // Sort by round descending
    return Object.entries(groupedWords)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .filter(([round]) => Number(round) < currentRound || allPlayersSubmitted)
      .map(([round, words]) => {
        // Create a map of word counts to find matches
        const wordCounts = words.reduce((acc, word) => {
          const normalizedWord = word.word.toLowerCase();
          acc[normalizedWord] = (acc[normalizedWord] || 0) + 1;
          return acc;
        }, {});

        return (
          <div key={round} className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Round {round}
            </h4>
            <div className="space-y-2">
              {words.map((word, index) => {
                const player = players.find((p) => p.id === word.player_id);
                // Word is matching if it appears more than once in this round
                const isMatching = wordCounts[word.word.toLowerCase()] > 1;

                return (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-gray-600">{player?.nickname}:</span>
                    <span className={`${isMatching ? 'font-bold text-green-600' : 'font-medium text-gray-900'}`}>
                      {word.word}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      });
  };

  // ---------------------------------------------------------
  // RETURN MAIN JSX
  // ---------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-4">
          <img src='/icons/WordSyncedLogo.svg' alt="Word Synced Logo" className="w-20 h-20 mr-2" />
          <h1 className="text-3xl font-bold text-gray-800">Word Synced</h1>
        </div>
        {/* Top Bar: Leave + Lobby Code */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleExit}
            className="text-gray-600 hover:text-gray-900 flex items-center"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Leave
          </button>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">Lobby Code:</p>
            <p className="text-3xl font-bold text-blue-600">{lobbyCode}</p>
          </div>
        </div>

        {/* If a player left, show a "Game Ended" screen */}
        {playerLeft && (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Game Ended
            </h2>
            <p className="text-gray-600 mb-6">A player has left the game.</p>
            <button
              onClick={handleCreateNewLobby}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Create New Lobby
            </button>
          </div>
        )}

        {/* If not enough players joined yet */}
        {!playerLeft && !allPlayersPresent && (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Waiting for players...
            </h2>
            <p className="text-gray-600">
              Share the lobby code with your friends to start playing!
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {players.length} of {maxPlayers} players joined
            </p>
            {/* Share Lobby button */}
            <button
              onClick={handleShareLobby}
              className="mt-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              Share Lobby
            </button>
            <img
              src='/icons/wordsyncedqr.png'
              alt="WordSynced QR"
              className="mx-auto mt-4 w-64 h-64"
            />
          </div>
        )}

        {/* Waiting for "Ready to Start" */}
        {!playerLeft && allPlayersPresent && gameStatus === 'waiting' && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Players</h3>
              <div className="space-y-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-gray-900">{player.nickname}</span>
                    {player.ready_to_start ? (
                      <span className="text-green-600 font-bold text-md">Ready</span>
                    ) : (
                      <span className="text-red-400 font-bold text-md">Not Ready</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {!isReadyToStart ? (
              <button
                onClick={handleReadyToStart}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Ready to Start
              </button>
            ) : (
              <div className="text-center text-gray-600">
                Waiting for other players to ready up...
              </div>
            )}
          </div>
        )}

        {/* Main "Playing" Screen */}
        {!playerLeft && allPlayersPresent && gameStatus === 'playing' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">Round</p>
                <p className="text-2xl font-bold text-blue-600">
                  {currentRound}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Players</p>
                <div className="space-y-1">
                  {players.map((p) => (
                    <p key={p.id} className="text-gray-600">
                      {p.nickname} {p.ready ? '✅' : '💬'}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {allWords.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Word History
                </h3>
                <div className="max-h-60 overflow-y-auto space-y-4">
                  {renderWordHistory()}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="word"
                  className="block text-sm font-medium text-gray-700"
                >
                  Enter your word
                </label>
                <input
                  type="text"
                  id="word"
                  value={currentWord}
                  onChange={(e) => setCurrentWord(e.target.value)}
                  disabled={isReady}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
                  placeholder="Type a word..."
                />
              </div>
              <button
                onClick={submitWord}
                disabled={isReady}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {isReady ? 'Waiting for other players...' : 'Submit Word'}
              </button>
            </div>
          </div>
        )}

        {/* Finished Screen */}
        {!playerLeft && gameStatus === 'finished' && (
          <div className="text-center space-y-6">
            <Confetti />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Game Over!
              </h2>
              <p className="text-lg text-gray-600">
                It took {currentRound} rounds to match words!
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">
                Word History
              </h3>
              <div className="max-h-60 overflow-y-auto space-y-4">
                {renderWordHistory()}
              </div>
            </div>
            <div className="space-y-2">
              {/* "Play Again" now sets wants_to_play_again = true */}
              {!currentPlayer?.wants_to_play_again && (
                <button
                  onClick={handlePlayAgain}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Play Again
                </button>
              )}
              {currentPlayer?.wants_to_play_again && (
                <p className="text-sm text-gray-600">
                  Waiting for everyone else to press Play Again...
                </p>
              )}

              <button
                onClick={handleShareScore}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                {shareButtonText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
