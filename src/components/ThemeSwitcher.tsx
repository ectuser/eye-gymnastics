import React, { useMemo } from 'react';
import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { type ThemePreference } from '../hooks/useThemePreference';

type Props = {
  preference: ThemePreference;
  systemTheme: 'light' | 'dark';
  onChange: (nextPreference: ThemePreference) => void;
  className?: string;
};

const iconMap: Record<ThemePreference, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: ComputerDesktopIcon,
};

const labelMap: Record<ThemePreference, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'Follow system theme',
};

const getNextPreference = (current: ThemePreference): ThemePreference => {
  switch (current) {
    case 'light':
      return 'dark';
    case 'dark':
      return 'system';
    default:
      return 'light';
  }
};

export const ThemeSwitcher: React.FC<Props> = ({ preference, onChange }) => {
  const Icon = iconMap[preference];
  const tooltipLabel = useMemo(() => labelMap[preference], [preference]);

  const handleClick = () => {
    onChange(getNextPreference(preference));
  };

  return (
   <button
      type="button"
      onClick={handleClick}
      className="btn btn-ghost gap-2 tooltip"
      data-tip={tooltipLabel}
      aria-label={tooltipLabel}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
};

export default ThemeSwitcher;
