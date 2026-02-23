import { useState, useRef, useEffect, useCallback } from "react";

/**
 * A hook for playing a specific audio file.
 * It manages the creation and playback of an HTMLAudioElement.
 * @param src The path to the audio file.
 */
export const useAudioPlayback = (src: string) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Effect to manage the audio element when src changes
  useEffect(() => {
    if (src) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      audioRef.current = new Audio(src);
      audioRef.current.loop = true; // Based on original AudioProvider
      audioRef.current.volume = 0.6; // Assuming a default volume
      
      // Stop playback if component unmounts
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
      };
    }
  }, [src]);

  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch((err) => console.error("Audio play failed:", err));
      setIsPlaying(true);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  return { play, stop, isPlaying };
};
