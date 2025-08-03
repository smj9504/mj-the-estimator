import styles from './AutoSaveIndicator.module.css';

const AutoSaveIndicator = ({ status = 'idle' }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'saving':
        return {
          text: 'Saving...',
          icon: '⏳',
          className: styles.saving
        };
      case 'saved':
        return {
          text: 'Saved',
          icon: '✓',
          className: styles.saved
        };
      case 'error':
        return {
          text: 'Save failed',
          icon: '⚠️',
          className: styles.error
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();
  
  if (!statusDisplay) {
    return null;
  }

  return (
    <div className={`${styles.indicator} ${statusDisplay.className}`}>
      <span className={styles.icon}>{statusDisplay.icon}</span>
      <span className={styles.text}>{statusDisplay.text}</span>
    </div>
  );
};

export default AutoSaveIndicator;