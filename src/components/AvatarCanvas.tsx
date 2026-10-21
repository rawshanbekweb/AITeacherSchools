'use client';
import { useEffect, useRef } from 'react';
import { Avatar } from '@/lib/client/avatar';
import type { AvatarConfig } from '@/lib/core/types';

/** React wrapper around the WebGL avatar engine. `onReady` hands the engine to the parent. */
export function AvatarCanvas({ config, className, onReady }: { config: AvatarConfig; className?: string; onReady?: (a: Avatar | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const avatar = useRef<Avatar | null>(null);
  const readyCb = useRef(onReady);
  useEffect(() => { readyCb.current = onReady; }, [onReady]);
  useEffect(() => {
    const a = new Avatar(canvas.current!, config);
    avatar.current = a;
    a.ready.then(() => { if (avatar.current === a) readyCb.current?.(a); }, (e) => console.error('avatar', e));
    return () => { a.destroy(); avatar.current = null; readyCb.current?.(null); };
    // the engine is created once; later config changes go through updateConfig below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void avatar.current?.updateConfig(config); }, [config]);
  return <canvas ref={canvas} className={className} aria-label={config.name} role="img" />;
}
