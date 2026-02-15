import { useState, useCallback, useRef } from 'react';
import type { ConfirmOptions } from '@core';
import { Modal } from './Modal';
import { Button } from './Button';
import { DialogActions } from './DialogActions';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const footer = (
    <DialogActions>
      <Button variant="secondary" onClick={onCancel}>
        {cancelText}
      </Button>
      <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
        {confirmText}
      </Button>
    </DialogActions>
  );

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} footer={footer}>
      <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{message}</p>
    </Modal>
  );
}

export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { isOpen: boolean }) | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, isOpen: true });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState(null);
  }, []);

  const ConfirmDialogRenderer = useCallback(() => {
    if (!state) return null;
    return (
      <ConfirmDialog
        isOpen={state.isOpen}
        title={state.title}
        message={state.message}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        destructive={state.destructive}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }, [state, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialogRenderer };
}
