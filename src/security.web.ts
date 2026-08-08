// Face ID/Touch ID has no web equivalent, and expo-local-authentication's
// web build isn't something this app ships — this stub is what makes Metro
// resolve here instead of the native module for the browser preview.

export async function isBiometricAvailable(): Promise<boolean> {
  return false;
}

export async function authenticate(_promptMessage: string): Promise<boolean> {
  return false;
}

export async function getBiometricLabel(): Promise<string> {
  return 'Face ID';
}
