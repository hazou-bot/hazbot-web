import React from 'react';
import { Text } from 'react-native';

import { useTheme } from '../theme';

/** Plain bold centered title — matches native iOS nav-bar titles (no colored badge). */
export function HeaderTitle({ children }: { children: string }) {
  const colors = useTheme();
  return (
    <Text
      style={{
        color: colors.text,
        fontWeight: '800',
        fontSize: 20,
        letterSpacing: -0.4,
      }}
    >
      {children}
    </Text>
  );
}
