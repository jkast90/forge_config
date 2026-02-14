import type { ReactNode, FormEvent } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { DialogActions } from './DialogActions';

export interface FormDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when dialog should close */
  onClose: () => void;
  /** Dialog title */
  title: string;
  /** Form submit handler */
  onSubmit: (e: FormEvent) => void | Promise<void>;
  /** Form content (rendered in scrollable body) */
  children: ReactNode;
  /** Submit button text (default: "Save") */
  submitText?: string;
  /** Cancel button text (default: "Cancel") */
  cancelText?: string;
  /** Whether form is currently submitting */
  saving?: boolean;
  /** Dialog variant */
  variant?: 'default' | 'wide' | 'extra-wide';
}

/**
 * FormDialog - a dialog wrapper specifically for forms.
 *
 * Layout:
 *   - Title bar with close (X) button
 *   - Scrollable body (children)
 *   - Fixed footer with Cancel / Submit buttons (always visible)
 *
 * The entire body+footer is wrapped in a <form> so submit buttons work.
 * Escape key and clicking outside the dialog will close it.
 */
export function FormDialog({
  isOpen,
  onClose,
  title,
  onSubmit,
  children,
  submitText = 'Save',
  cancelText = 'Cancel',
  saving = false,
  variant,
}: FormDialogProps) {
  const footer = (
    <DialogActions>
      <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
        {cancelText}
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving...' : submitText}
      </Button>
    </DialogActions>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant={variant}
      onSubmit={onSubmit}
      footer={footer}
    >
      {children}
    </Modal>
  );
}
