import { useState, useCallback } from 'react';
import { IconButton } from './IconButton';
import { Icon } from './Icon';

interface CopyButtonProps {
  text: string;
  size?: number;
}

export function CopyButton({ text, size = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <IconButton variant="ghost" size="sm" onClick={handleCopy} title={copied ? 'Copied!' : 'Copy to clipboard'}>
      <Icon name={copied ? 'check' : 'content_copy'} size={size} />
    </IconButton>
  );
}
