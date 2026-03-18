import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { trpc } from '@/lib/trpc';
import { router, useSegments } from 'expo-router';

/**
 * License Guard
 * Ensures the user has a valid license before accessing the app.
 */
export function LicenseGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const { data: licenseStatus, isLoading, error } = trpc.license.getUserLicenses.useQuery({}, {
    // Only fetch if we're not already on the activation screen
    enabled: segments[0] !== 'license-activation' && segments[0] !== 'oauth',
    retry: false,
  });

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'oauth';
    const inActivationScreen = segments[0] === 'license-activation';

    // If we have an error (e.g. 401 unauthed), the auth guard should handle it
    // but if we're logged in and have no active license, go to activation
    if (!isLoading && !inAuthGroup && !inActivationScreen) {
      const activeLicense = licenseStatus?.licenses?.find(l => l.status === 'active');
      
      if (!activeLicense && licenseStatus?.success !== false) {
        router.replace('/license-activation');
      }
    }
  }, [licenseStatus, isLoading, segments]);

  if (isLoading && segments[0] !== 'license-activation' && segments[0] !== 'oauth') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <>{children}</>;
}
