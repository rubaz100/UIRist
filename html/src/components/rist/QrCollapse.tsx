import React from 'react';
import { Collapse } from 'react-bootstrap';
import { QRCodeSVG } from 'qrcode.react';

interface QrCollapseProps {
  open: boolean;
  value: string;
  size?: number;
}

/** Wrap a QR code in a Bootstrap collapse with a white background so dark themes still scan. */
export const QrCollapse: React.FC<QrCollapseProps> = ({ open, value, size = 160 }) => (
  <Collapse in={open}>
    <div
      className="mt-2 d-flex justify-content-center p-2 rounded"
      style={{ background: '#fff', display: 'inline-block' }}
    >
      <QRCodeSVG value={value} size={size} />
    </div>
  </Collapse>
);
