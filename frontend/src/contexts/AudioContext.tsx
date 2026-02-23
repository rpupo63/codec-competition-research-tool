import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

interface AudioContextType {
  isGloballyMuted: boolean;
  toggleGlobalMute: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  const [isGloballyMuted, setIsGloballyMuted] = useState<boolean>(false);

  const toggleGlobalMute = useCallback(() => {
    setIsGloballyMuted(prev => !prev);
  }, []);

  return (
    <AudioContext.Provider value={{ isGloballyMuted, toggleGlobalMute }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
