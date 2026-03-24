import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { trpc } from '@/lib/trpc';
import { router } from 'expo-router';

// usePathname is exported from expo-router/build/hooks but not from the main index types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { usePathname } = require('expo-router') as { usePathname: () => string };

/**
 * License Guard
 * Ensures the user has a valid license before accessing the app.
 */
export function LicenseGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const firstSegment = pathname.split('/').filter(Boolean)[0] || '';
  const { data: licenseStatus, isLoading, error } = trpc.license.getUserLicenses.useQuery({}, {
    // Only fetch if we're not already on the activation screen AND license check is enabled
    enabled: firstSegment !== 'license-activation' && 
             firstSegment !== 'oauth' && 
             process.env.EXPO_PUBLIC_ENABLE_LICENSE_CHECK !== 'false',
    retry: false,
  });

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = firstSegment === 'oauth';
    const inActivationScreen = firstSegment === 'license-activation';

    // If we have an error (e.g. 401 unauthed), the auth guard should handle it
    // but if we're logged in and have no active license, go to activation
    if (!isLoading && !inAuthGroup && !inActivationScreen) {
      // Bypass if license check is disabled
      const isBypass = process.env.EXPO_PUBLIC_ENABLE_LICENSE_CHECK === 'false';
      console.log('LicenseGuard: isBypass=', isBypass, 'Segment=', firstSegment);
      if (isBypass) return;

      const activeLicense = licenseStatus?.licenses?.find((l: any) => l.status === 'active');
      
      if (!activeLicense && licenseStatus?.success !== false) {
        router.replace('/license-activation');
      }
    }
  }, [licenseStatus, isLoading, firstSegment]);

  if (isLoading && firstSegment !== 'license-activation' && firstSegment !== 'oauth') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <>{children}</>;
}

