import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check if theme is stored in localStorage
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    
    // Check if user prefers dark mode
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    return savedTheme || (prefersDark ? 'dark' : 'light');
  });

  useEffect(() => {
    // Update document class when theme changes
    const root = window.document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Store theme in localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
}