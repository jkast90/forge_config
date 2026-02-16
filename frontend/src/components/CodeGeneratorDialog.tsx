import { useState, useCallback, useRef, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Icon } from './Icon';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

type CodeType = 'qr' | 'barcode';
type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'UPC' | 'ITF14';

interface HistoryEntry {
  id: number;
  text: string;
  type: CodeType;
  format?: BarcodeFormat;
  timestamp: number;
}

const STORAGE_KEY = 'fc_code_generator_history';
const MAX_HISTORY = 50;

const BARCODE_FORMATS: { value: BarcodeFormat; label: string; description: string }[] = [
  { value: 'CODE128', label: 'Code 128', description: 'Alphanumeric, variable length' },
  { value: 'CODE39', label: 'Code 39', description: 'Alphanumeric, uppercase only' },
  { value: 'EAN13', label: 'EAN-13', description: '13-digit product code' },
  { value: 'UPC', label: 'UPC-A', description: '12-digit product code' },
  { value: 'ITF14', label: 'ITF-14', description: '14-digit shipping code' },
];

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CodeGeneratorDialog({ isOpen, onClose }: Props) {
  const [text, setText] = useState('');
  const [codeType, setCodeType] = useState<CodeType>('qr');
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>('CODE128');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setGeneratedImage(null);
      setError(null);
    }
  }, [isOpen]);

  const generate = useCallback(async (value: string, type: CodeType, format: BarcodeFormat) => {
    if (!value.trim()) return;
    setError(null);
    setGeneratedImage(null);

    try {
      if (type === 'qr') {
        const dataUrl = await QRCode.toDataURL(value, {
          width: 280,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setGeneratedImage(dataUrl);
      } else {
        // Barcode via canvas
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
          JsBarcode(canvas, value, {
            format,
            width: 2,
            height: 80,
            displayValue: true,
            fontSize: 14,
            margin: 10,
            background: '#ffffff',
            lineColor: '#000000',
          });
          setGeneratedImage(canvas.toDataURL('image/png'));
        } catch {
          setError(`Invalid input for ${format} format.`);
          return;
        }
      }

      // Add to history
      const entry: HistoryEntry = {
        id: Date.now(),
        text: value,
        type,
        format: type === 'barcode' ? format : undefined,
        timestamp: Date.now(),
      };
      setHistory(prev => {
        // Deduplicate: remove existing entry with same text+type+format
        const filtered = prev.filter(h =>
          !(h.text === entry.text && h.type === entry.type && h.format === entry.format)
        );
        const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
        saveHistory(updated);
        return updated;
      });
    } catch {
      setError('Failed to generate code. Check your input.');
    }
  }, []);

  const handleGenerate = useCallback(() => {
    generate(text, codeType, barcodeFormat);
  }, [text, codeType, barcodeFormat, generate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && text.trim()) {
      e.preventDefault();
      handleGenerate();
    }
  }, [text, handleGenerate]);

  const handleHistoryClick = useCallback((entry: HistoryEntry) => {
    setText(entry.text);
    setCodeType(entry.type);
    if (entry.format) setBarcodeFormat(entry.format);
    generate(entry.text, entry.type, entry.format || 'CODE128');
  }, [generate]);

  const handleDeleteHistory = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => {
      const updated = prev.filter(h => h.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const handleDownload = useCallback(() => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.download = `${codeType}-${text.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = generatedImage;
    link.click();
  }, [generatedImage, codeType, text]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Code Generator"
      variant="wide"
    >
      <div style={{ display: 'flex', gap: '16px', minHeight: '400px' }}>
        {/* Left: Generator */}
        <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary, rgba(128,128,128,0.1))', borderRadius: '8px', padding: '3px' }}>
            <button
              type="button"
              onClick={() => { setCodeType('qr'); setGeneratedImage(null); setError(null); }}
              style={{
                flex: 1,
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                background: codeType === 'qr' ? 'var(--color-primary, #4a9eff)' : 'transparent',
                color: codeType === 'qr' ? '#fff' : 'var(--color-text)',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon name="qr_code_2" size={14} /> QR Code
            </button>
            <button
              type="button"
              onClick={() => { setCodeType('barcode'); setGeneratedImage(null); setError(null); }}
              style={{
                flex: 1,
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                background: codeType === 'barcode' ? 'var(--color-primary, #4a9eff)' : 'transparent',
                color: codeType === 'barcode' ? '#fff' : 'var(--color-text)',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon name="barcode" size={14} /> Barcode
            </button>
          </div>

          {/* Barcode format selector */}
          {codeType === 'barcode' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 500 }}>Format</label>
              <select
                value={barcodeFormat}
                onChange={e => { setBarcodeFormat(e.target.value as BarcodeFormat); setGeneratedImage(null); }}
                style={{ fontSize: '13px' }}
              >
                {BARCODE_FORMATS.map(f => (
                  <option key={f.value} value={f.value}>{f.label} — {f.description}</option>
                ))}
              </select>
            </div>
          )}

          {/* Input */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={codeType === 'qr' ? 'URL, serial number, text...' : 'Value to encode...'}
              style={{ flex: 1, fontSize: '14px' }}
            />
            <Button onClick={handleGenerate} disabled={!text.trim()}>
              Generate
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          {/* Result */}
          {generatedImage && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '20px',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}>
              <img
                src={generatedImage}
                alt={`${codeType}: ${text}`}
                style={{ maxWidth: '100%', imageRendering: codeType === 'qr' ? 'pixelated' : 'auto' }}
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <code style={{ fontSize: '12px', color: '#333', wordBreak: 'break-all', textAlign: 'center' }}>
                  {text}
                </code>
              </div>
              <Button variant="secondary" onClick={handleDownload}>
                <Icon name="download" size={14} /> Download PNG
              </Button>
            </div>
          )}

          {/* Hidden canvas for barcode rendering */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Right: History */}
        <div style={{
          flex: '0 0 200px',
          borderLeft: '1px solid var(--border-color)',
          paddingLeft: '16px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.6 }}>
              History
            </span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: 'var(--color-text-muted)',
                  padding: '2px 4px',
                }}
                title="Clear history"
              >
                Clear
              </button>
            )}
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}>
            {history.length === 0 ? (
              <div style={{ fontSize: '12px', opacity: 0.4, padding: '12px 0', textAlign: 'center' }}>
                No history yet
              </div>
            ) : (
              history.map(entry => (
                <div
                  key={entry.id}
                  onClick={() => handleHistoryClick(entry)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'background 0.1s',
                  }}
                  className="hover-highlight"
                  title={entry.text}
                >
                  <Icon
                    name={entry.type === 'qr' ? 'qr_code_2' : 'barcode'}
                    size={13}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                    }}>
                      {entry.text}
                    </div>
                    <div style={{ fontSize: '10px', opacity: 0.5 }}>
                      {entry.type === 'barcode' && entry.format ? `${entry.format} · ` : ''}
                      {formatTime(entry.timestamp)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={e => handleDeleteHistory(entry.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      opacity: 0.3,
                      fontSize: '11px',
                      color: 'var(--color-text)',
                      flexShrink: 0,
                    }}
                    title="Remove"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
