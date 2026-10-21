'use client';
import { createContext, useContext } from 'react';
import type { SessionUser } from '@/lib/core/types';

const Ctx = createContext<SessionUser | null>(null);
export const MeProvider = ({ user, children }: { user: SessionUser; children: React.ReactNode }) => <Ctx.Provider value={user}>{children}</Ctx.Provider>;
export const useMe = () => useContext(Ctx)!;
