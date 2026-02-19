import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Icon } from './Icon';

export interface CsvPreviewSheet {
  name: string;
  rows: (string | number)[][];
}

interface CsvPreviewModalProps {
  title: string;
  sheets: CsvPreviewSheet[];
  filename: string;
  onClose: () => void;
  onDownload: () => void;
}

export function CsvPreviewModal({ title, sheets, filename, onClose, onDownload }: CsvPreviewModalProps) {
  const [activeSheet, setActiveSheet] = useState(0);

  const sheet = sheets[activeSheet] ?? sheets[0];
  const [headerRow, ...dataRows] = sheet?.rows ?? [];

  const nonEmptyDataRows = dataRows.filter(row => row.length > 0 && row.some(cell => cell !== ''));

  return (
    <Modal
      title={title}
      onClose={onClose}
      variant="extra-wide"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontFamily: 'monospace' }}>
            {filename}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={onDownload}>
              <Icon name="download" size={14} />
              Download
            </Button>
          </div>
        </div>
      }
    >
      {sheets.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
          {sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSheet(i)}
              style={{
                padding: '3px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                background: i === activeSheet ? 'var(--color-accent-blue)' : 'transparent',
                color: i === activeSheet ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
                fontSize: 12,
                transition: 'background 0.1s',
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '62vh' }}>
        {(!sheet || sheet.rows.length === 0) ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 24 }}>No data</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            {headerRow && (
              <thead>
                <tr>
                  {(Array.isArray(headerRow) ? headerRow : [headerRow]).map((cell, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '6px 10px',
                        background: 'var(--color-surface-2)',
                        textAlign: 'left',
                        borderBottom: '2px solid var(--color-border)',
                        whiteSpace: 'nowrap',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        fontWeight: 600,
                      }}
                    >
                      {String(cell ?? '')}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {dataRows.map((row, ri) => {
                const isEmpty = !row.length || row.every(cell => cell === '' || cell == null);
                if (isEmpty) {
                  return (
                    <tr key={ri}>
                      <td
                        colSpan={Array.isArray(headerRow) ? headerRow.length : 1}
                        style={{ padding: '3px 0', borderBottom: '1px solid var(--color-border)' }}
                      />
                    </tr>
                  );
                }
                return (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'var(--color-surface-1)' }}>
                    {(Array.isArray(row) ? row : [row]).map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: '4px 10px',
                          borderBottom: '1px solid var(--color-border)',
                          whiteSpace: 'nowrap',
                          color: cell === '' || cell == null ? 'var(--color-text-secondary)' : undefined,
                        }}
                      >
                        {String(cell ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {nonEmptyDataRows.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
          {nonEmptyDataRows.length} row{nonEmptyDataRows.length !== 1 ? 's' : ''}
          {sheets.length > 1 ? ` · sheet ${activeSheet + 1} of ${sheets.length}` : ''}
        </div>
      )}
    </Modal>
  );
}
