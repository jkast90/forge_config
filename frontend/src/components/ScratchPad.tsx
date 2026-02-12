import { useState, useRef, useCallback, useEffect } from 'react';
import { Icon } from './Icon';

const STORAGE_KEY = 'ztp_scratchpad';
const POS_KEY = 'ztp_scratchpad_pos';
const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const PAD = 8;

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getDefaultPosition(): Position {
  return {
    x: window.innerWidth - 340,
    y: window.innerHeight - 340,
    width: 320,
    height: 280,
  };
}

function loadPosition(): Position {
  try {
    const stored = localStorage.getItem(POS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return getDefaultPosition();
}

function clampPosition(pos: Position): Position {
  const w = Math.min(pos.width, window.innerWidth - PAD * 2);
  const h = Math.min(pos.height, window.innerHeight - PAD * 2);
  const maxX = window.innerWidth - w - PAD;
  const maxY = window.innerHeight - h - PAD;
  return {
    width: w,
    height: h,
    x: Math.max(PAD, Math.min(pos.x, maxX)),
    y: Math.max(PAD, Math.min(pos.y, maxY)),
  };
}

interface ScratchPadProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScratchPad({ isOpen, onClose }: ScratchPadProps) {
  const [content, setContent] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const posRef = useRef<Position>(clampPosition(loadPosition()));
  const [pos, setPos] = useState<Position>(posRef.current);
  const modeRef = useRef<'idle' | 'drag' | 'resize'>('idle');
  const startRef = useRef({ x: 0, y: 0 });
  const resizeElRef = useRef<HTMLDivElement>(null);

  // Keep posRef in sync
  useEffect(() => { posRef.current = pos; }, [pos]);

  // Persist content
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, content);
  }, [content]);

  // Persist position
  useEffect(() => {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  }, [pos]);

  // Clamp on window resize
  useEffect(() => {
    const handler = () => setPos((p) => clampPosition(p));
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Native mousedown on resize handle — avoids React event issues
  useEffect(() => {
    const el = resizeElRef.current;
    if (!el) return;
    const onDown = (e: MouseEvent) => {
      modeRef.current = 'resize';
      startRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('mousedown', onDown, { capture: true });
    return () => el.removeEventListener('mousedown', onDown, { capture: true });
  });

  // Global mousemove / mouseup
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (modeRef.current === 'idle') return;

      if (modeRef.current === 'drag') {
        setPos((p) => clampPosition({
          ...p,
          x: e.clientX - startRef.current.x,
          y: e.clientY - startRef.current.y,
        }));
      } else if (modeRef.current === 'resize') {
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        startRef.current = { x: e.clientX, y: e.clientY };
        setPos((p) => clampPosition({
          ...p,
          width: Math.max(MIN_WIDTH, p.width + dx),
          height: Math.max(MIN_HEIGHT, p.height + dy),
        }));
      }
    };
    const onUp = () => { modeRef.current = 'idle'; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    modeRef.current = 'drag';
    const p = posRef.current;
    startRef.current = { x: e.clientX - p.x, y: e.clientY - p.y };
    e.preventDefault();
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="scratchpad"
      style={{
        left: pos.x,
        top: pos.y,
        width: pos.width,
        height: pos.height,
      }}
    >
      <div className="scratchpad-header" onMouseDown={onHeaderMouseDown}>
        <Icon name="sticky_note_2" size={16} />
        <span className="scratchpad-title">Notes</span>
        <button
          className="scratchpad-close"
          onClick={onClose}
          title="Minimize"
        >
          <Icon name="minimize" size={16} />
        </button>
      </div>
      <textarea
        className="scratchpad-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Jot down notes here..."
        spellCheck={false}
      />
      <div ref={resizeElRef} className="scratchpad-resize" />
    </div>
  );
}
