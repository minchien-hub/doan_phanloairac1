import { ColorSchemeName, useColorScheme as useColorSchemeCore } from 'react-native';

export const useColorScheme = (): NonNullable<ColorSchemeName> => {
  return useColorSchemeCore() ?? 'light';
};
