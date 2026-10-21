'use client';
import { Download, Printer } from 'lucide-react';
import type { SessionReport } from '@/lib/core/types';

export function ReportActions({ report: r }: { report: SessionReport }) {
  function csv() {
    const rows: unknown[][] = [['student', 'status', 'method', 'changedBy'], ...r.attendance.map((a) => [a.fullName, a.status, a.method ?? '', a.changedBy ?? '']), [], ['question', 'answer', 'correct'], ...r.results.map((x) => [x.question, x.answer, x.correct])];
    const text = rows.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' }));
    a.download = `report-${r.session.id}.csv`;
    a.click();
  }
  return (
    <>
      <button className="btn" onClick={csv}><Download size={16} />CSV</button>
      <button className="btn" onClick={() => window.print()}><Printer size={16} />Chop etish</button>
    </>
  );
}
