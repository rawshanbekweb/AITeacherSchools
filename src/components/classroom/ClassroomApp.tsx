'use client';
import { useState } from 'react';
import type { SessionUser } from '@/lib/core/types';
import { I18nProvider } from '@/lib/client/i18n';
import { ToastProvider } from '@/components/ui/Toast';
import type { StartData } from '@/lib/client/lesson-controller';
import { Setup } from './Setup';
import { LessonView } from './LessonView';

export function ClassroomApp({ user }: { user: SessionUser }) {
  const [started, setStarted] = useState<{ data: StartData; health: { ok: boolean; ai: string; tts: string }; type: string } | null>(null);
  return (
    <I18nProvider>
      <ToastProvider dark>
        <div className={`classroom-root dark-surface min-h-dvh mode-${started?.type ?? user.institutionType ?? 'school'}`}>
          {started ? (
            <LessonView data={started.data} health={started.health} institutionType={started.type} onExit={() => setStarted(null)} />
          ) : (
            <Setup user={user} onStart={(data, health, type) => setStarted({ data, health, type })} />
          )}
        </div>
      </ToastProvider>
    </I18nProvider>
  );
}
