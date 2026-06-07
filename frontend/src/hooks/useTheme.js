import { useCallback, useEffect, useState } from 'react';
import { applyTheme, getSavedTheme } from '../utils/theme';

export default function useTheme() {
  const [theme, setTheme] = useState(() => getSavedTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
  };
};
