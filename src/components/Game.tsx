import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

interface GameProps {
  lobbyCode: string;
  playerId: string;
  nickname: string;
  onExit: () => void;
}

interface Player {
  id: string;
  nickname: string;
  current_word: string | null;
  ready: boolean;
  wants_to_play_again: boolean;
}

interface Word {
  word: string;
  player_id: string;
  round: number;
}

export default function Game({ lobbyCode, playerId, nickname, onExit }: GameProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [currentRound, setCurrentRound] = useState(1);
  const [roundWords, setRoundWords] = useState<Word[]>([]);
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [playerLeft, setPlayerLeft] = useState(false);

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      const [playersData, lobbyData, wordsData] = await Promise.all([
        supabase.from('players').select('*').eq('lobby_code', lobbyCode),
        supabase.from('lobbies').select('*').eq('code', lobbyCode).single(),
        supabase.from('words').select('*').eq('lobby_code', lobbyCode).order('round', { ascending: true })
      ]);

      if (playersData.data) setPlayers(playersData.data);
      if (lobbyData.data) {
        setGameStatus(lobbyData.data.game_status);
        setCurrentRound(lobbyData.data.current_round);
        setWinner(lobbyData.data.winner);
      }
      if (wordsData.data) {
        setAllWords(wordsData.data);
        const currentRoundWords = wordsData.data.filter(w => w.round === currentRound);
        setRoundWords(currentRoundWords);
      }
    };

    fetchInitialData();
  }, [lobbyCode]);

  // Real-time subscriptions
  useEffect(() => {
    const playersSubscription = supabase
      .channel('game-players')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'players',
          filter: `lobby_code=eq.${lobbyCode}`
        },
        async (payload) => {
          const { data } = await supabase
            .from('players')
            .select('*')
            .eq('lobby_code', lobbyCode);
          
          if (data) {
            console.log('Players updated:', data);
            setPlayers(data);
            
            // Check if a player left
            if (data.length === 1 && players.length === 2) {
              setPlayerLeft(true);
              toast.error('Other player has left the game');
            }
            
            // Check if both players want to play again
            if (data.length === 2 && data.every(p => p.wants_to_play_again)) {
              handleStartNewGame();
            }
          }
        }
      )
      .subscribe();

    const lobbySubscription = supabase
      .channel('game-lobby')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobbies',
          filter: `code=eq.${lobbyCode}`
        },
        async (payload) => {
          console.log('Lobby updated:', payload);
          setGameStatus(payload.new.game_status);
          setCurrentRound(payload.new.current_round);
          if (payload.new.winner) {
            setWinner(payload.new.winner);
          }
        }
      )
      .subscribe();

    const wordsSubscription = supabase
      .channel('game-words')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'words',
          filter: `lobby_code=eq.${lobbyCode}`
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
            const currentRoundWords = data.filter(w => w.round === currentRound);
            setRoundWords(currentRoundWords);
          }
        }
      )
      .subscribe();

    return () => {
      playersSubscription.unsubscribe();
      lobbySubscription.unsubscribe();
      wordsSubscription.unsubscribe();
    };
  }, [lobbyCode, currentRound, players.length]);

  const submitWord = async () => {
    if (!currentWord.trim()) {
      toast.error('Please enter a word');
      return;
    }

    const normalizedWord = currentWord.toLowerCase().trim();

    // Check if the word has been used in previous rounds
    const wordUsedInPreviousRounds = allWords.some(w => 
      w.round < currentRound && w.word.toLowerCase() === normalizedWord
    );
    
    if (wordUsedInPreviousRounds) {
      toast.error('This word has been used in a previous round. Try a different word!');
      return;
    }

    try {
      // Submit word
      await supabase.from('words').insert([
        {
          lobby_code: lobbyCode,
          player_id: playerId,
          word: normalizedWord,
          round: currentRound,
        },
      ]);

      // Update player ready status
      await supabase
        .from('players')
        .update({ current_word: currentWord, ready: true })
        .eq('id', playerId);

      setCurrentWord('');

      // Check if both players have submitted
      const { data: words } = await supabase
        .from('words')
        .select('word')
        .eq('lobby_code', lobbyCode)
        .eq('round', currentRound);

      if (words && words.length === 2) {
        // Check if words match
        if (words[0].word === words[1].word) {
          // Game won!
          await supabase
            .from('lobbies')
            .update({
              game_status: 'finished',
              winner: nickname,
              rounds_taken: currentRound,
            })
            .eq('code', lobbyCode);
        } else {
          // Next round
          await supabase
            .from('lobbies')
            .update({
              current_round: currentRound + 1,
            })
            .eq('code', lobbyCode);

          // Reset player ready status
          await supabase
            .from('players')
            .update({ ready: false, current_word: null })
            .eq('lobby_code', lobbyCode);
        }
      }
    } catch (error) {
      console.error('Error submitting word:', error);
      toast.error('Failed to submit word');
    }
  };

  const handleExit = async () => {
    try {
      await supabase.from('players').delete().eq('id', playerId);
      onExit();
    } catch (error) {
      console.error('Error leaving game:', error);
      toast.error('Failed to leave game');
    }
  };

  const handlePlayAgain = async () => {
    try {
      // Update current player's play again status
      await supabase
        .from('players')
        .update({ wants_to_play_again: true })
        .eq('id', playerId);

      toast.success('Waiting for other player to play again...');
    } catch (error) {
      console.error('Error requesting play again:', error);
      toast.error('Failed to request play again');
    }
  };

  const handleStartNewGame = async () => {
    try {
      await supabase
        .from('lobbies')
        .update({
          game_status: 'playing',
          current_round: 1,
          winner: null,
          rounds_taken: null,
        })
        .eq('code', lobbyCode);

      await supabase
        .from('players')
        .update({ 
          ready: false, 
          current_word: null,
          wants_to_play_again: false 
        })
        .eq('lobby_code', lobbyCode);

      await supabase.from('words').delete().eq('lobby_code', lobbyCode);

      setCurrentWord('');
      setWinner(null);
      setAllWords([]);
    } catch (error) {
      console.error('Error restarting game:', error);
      toast.error('Failed to restart game');
    }
  };

  const handleCreateNewLobby = async () => {
    try {
      // Clean up current lobby first
      await handleExit();
      
      // Redirect to home to create a new lobby
      onExit();
    } catch (error) {
      console.error('Error creating new lobby:', error);
      toast.error('Failed to create new lobby');
    }
  };

  const otherPlayer = players.find((p) => p.id !== playerId);
  const currentPlayer = players.find((p) => p.id === playerId);
  const isReady = currentPlayer?.ready;
  const bothPlayersPresent = players.length === 2;
  const bothPlayersSubmitted = roundWords.length === 2;

  const renderWordHistory = () => {
    const groupedWords = allWords.reduce((acc, word) => {
      if (!acc[word.round]) {
        acc[word.round] = [];
      }
      acc[word.round].push(word);
      return acc;
    }, {} as Record<number, Word[]>);

    return Object.entries(groupedWords)
      .filter(([round]) => Number(round) < currentRound || bothPlayersSubmitted)
      .map(([round, words]) => (
        <div key={round} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Round {round}</h4>
          <div className="space-y-2">
            {words.map((word, index) => {
              const player = players.find((p) => p.id === word.player_id);
              return (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-600">{player?.nickname}:</span>
                  <span className="font-medium text-gray-900">{word.word}</span>
                </div>
              );
            })}
          </div>
        </div>
      ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
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
            <p className="text-lg font-bold text-indigo-600">{lobbyCode}</p>
          </div>
        </div>

        {playerLeft && (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Game Ended</h2>
            <p className="text-gray-600 mb-6">The other player has left the game.</p>
            <button
              onClick={handleCreateNewLobby}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Create New Lobby
            </button>
          </div>
        )}

        {!playerLeft && !bothPlayersPresent && (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Waiting for opponent...</h2>
            <p className="text-gray-600">Share the lobby code with your friend to start playing!</p>
          </div>
        )}

        {!playerLeft && bothPlayersPresent && gameStatus !== 'finished' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">Round</p>
                <p className="text-2xl font-bold text-indigo-600">{currentRound}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Players</p>
                <p className="text-gray-600">
                  {nickname} vs {otherPlayer?.nickname}
                </p>
              </div>
            </div>

            {/* Word History */}
            {allWords.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Word History</h3>
                <div className="max-h-60 overflow-y-auto space-y-4">
                  {renderWordHistory()}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="word" className="block text-sm font-medium text-gray-700">
                  Enter your word
                </label>
                <input
                  type="text"
                  id="word"
                  value={currentWord}
                  onChange={(e) => setCurrentWord(e.target.value)}
                  disabled={isReady}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
                  placeholder="Type a word..."
                />
              </div>
              <button
                onClick={submitWord}
                disabled={isReady}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isReady ? 'Waiting for other player...' : 'Submit Word'}
              </button>
            </div>
          </div>
        )}

        {!playerLeft && gameStatus === 'finished' && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Game Over!</h2>
              <p className="text-lg text-gray-600">
                It took {currentRound} rounds to match words!
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Final Word History</h3>
              <div className="max-h-60 overflow-y-auto space-y-4">
                {renderWordHistory()}
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={handlePlayAgain}
                disabled={currentPlayer?.wants_to_play_again}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {currentPlayer?.wants_to_play_again 
                  ? 'Waiting for other player...' 
                  : 'Play Again'}
              </button>
              {players.some(p => p.wants_to_play_again) && (
                <p className="text-sm text-gray-600">
                  {players.filter(p => p.wants_to_play_again).map(p => p.nickname).join(', ')} 
                  {players.filter(p => p.wants_to_play_again).length === 1 ? ' wants' : ' want'} to play again
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}