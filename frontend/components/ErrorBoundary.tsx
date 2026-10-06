import React from 'react';
import { View, StyleSheet } from 'react-native';
import { t } from '../utils/i18n';
import { Txt, Icon, Button } from './ui';
import { COLOR, SPACE } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Erreur inattendue de rendu : même gabarit que les états vides SKILKI (pictogramme Lucide, une action jaune).
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error silently - could send to error reporting service
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconWrap}><Icon name="warning" size={32} color={COLOR.text.secondary} /></View>
          <Txt variant="h2" align="center">{t('error.title')}</Txt>
          <Txt variant="body" color={COLOR.text.secondary} align="center">{t('error.subtitle')}</Txt>
          <Button label={t('common.retry')} onPress={this.handleRetry} style={styles.cta} />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.xxl,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLOR.surface.subtle,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACE.sm,
  },
  cta: { marginTop: SPACE.lg, alignSelf: 'stretch' },
});

export default ErrorBoundary;
