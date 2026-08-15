import type { ReactNode } from 'react';
import { AnalyticsProvider } from '@/features/analytics';
import { AuthProvider } from '@/features/auth';
import { LinksProvider } from '@/features/links';
import { InvitesProvider, MembersProvider, TeamsProvider } from '@/features/teams';

export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <AuthProvider>
      <TeamsProvider>
        <MembersProvider>
          <InvitesProvider>
            <AnalyticsProvider>
              <LinksProvider>{children}</LinksProvider>
            </AnalyticsProvider>
          </InvitesProvider>
        </MembersProvider>
      </TeamsProvider>
    </AuthProvider>
  );
}
