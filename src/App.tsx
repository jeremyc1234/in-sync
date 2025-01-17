import React, { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import CreateLobby from './components/CreateLobby';
import JoinLobby from './components/JoinLobby';
import Game from './components/Game';

function App() {
  const [gameState, setGameState] = useState<{
    lobbyCode?: string;
    playerId?: string;
    nickname?: string;
  }>({});

  const handleJoinGame = (lobbyCode: string, playerId: string, nickname: string) => {
    setGameState({ lobbyCode, playerId, nickname });
  };

  if (gameState.lobbyCode && gameState.playerId) {
    return <Game 
      lobbyCode={gameState.lobbyCode} 
      playerId={gameState.playerId} 
      nickname={gameState.nickname!}
      onExit={() => setGameState({})}
    />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <Toaster position="top-center" />
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Gamepad2 className="w-12 h-12 text-indigo-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-800">Word Match</h1>
        </div>

        <div className="space-y-6">
          <CreateLobby onJoin={handleJoinGame} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>
          <JoinLobby onJoin={handleJoinGame} />
        </div>
      </div>
    </div>
  );
}

export default App;