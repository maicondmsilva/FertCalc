import { useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const playSound = useCallback((group?: string) => {
    // We synthesize a short "ding" sound using Web Audio API safely
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Slightly different tones based on group
      if (group === 'SYSTEM') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
      } else if (group === 'TRANSFER') {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
      } else {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
      }

      osc.type = 'sine';

      // Quick fade out envelope
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      logger.warn('Could not play notification sound', e);
    }
  }, []);

  return { playSound };
}
