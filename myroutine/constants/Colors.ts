const tintColorLight = '#31a077';
const tintColorDark = '#31a077';

export default {
  light: {
    text: '#20272d',
    background: '#fdfefe',
    tint: tintColorLight,
    tabIconDefault: '#444a48',
    tabIconSelected: tintColorLight,
    tabIconBadge: '#22c55e', // Green for notifications
    cardBackground: '#f5f5f5',
  },
  dark: {
    text: '#fdfefe',
    background: '#20272d',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
    tabIconBadge: '#22c55e', // Keep green/visible in dark mode too
    cardBackground: '#444a48', // Using the dark gray/accent from palette as card bg
  },
};
