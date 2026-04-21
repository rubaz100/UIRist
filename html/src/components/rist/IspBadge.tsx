import React, { useState, useEffect } from 'react';
import { ristApiService } from '../../services/rist-api.service';

// Module-level cache — survives re-renders and component remounts
const ispCache = new Map<string, { isp: string | null; country: string | null } | 'loading' | 'error'>();

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('127.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === '::1' ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  );
}

interface IspBadgeProps {
  ip: string;
}

export const IspBadge: React.FC<IspBadgeProps> = ({ ip }) => {
  const [info, setInfo] = useState<{ isp: string | null; country: string | null } | null>(null);

  useEffect(() => {
    if (!ip || isPrivateIp(ip)) return;

    const cached = ispCache.get(ip);
    if (cached && cached !== 'loading') {
      if (cached !== 'error') setInfo(cached);
      return;
    }
    if (cached === 'loading') {
      // poll until resolved
      const timer = setInterval(() => {
        const c = ispCache.get(ip);
        if (c && c !== 'loading') {
          clearInterval(timer);
          if (c !== 'error') setInfo(c);
        }
      }, 200);
      return () => clearInterval(timer);
    }

    ispCache.set(ip, 'loading');
    ristApiService.ipLookup(ip)
      .then(res => {
        const entry = { isp: res.isp, country: res.country };
        ispCache.set(ip, entry);
        setInfo(entry);
      })
      .catch(() => {
        ispCache.set(ip, 'error');
      });
  }, [ip]);

  if (!info || !info.isp) return null;

  return (
    <span className="ms-1 d-inline-flex align-items-center gap-1" style={{ fontSize: '0.68rem' }}>
      <span className="text-secondary">·</span>
      <span className="text-muted">{info.isp}</span>
      {info.country && (
        <span className="text-muted opacity-75">{info.country}</span>
      )}
    </span>
  );
};
