import React from 'react';
import { useRouter } from 'expo-router';
import IconButton from './IconButton';
import { t } from '../../utils/i18n';

type Props = { onPress?: () => void; icon?: 'back' | 'close'; testID?: string };

// Bouton retour unique (44 px). Par défaut : router.back().
export default function BackButton({ onPress, icon = 'back', testID = 'back-btn' }: Props) {
  const router = useRouter();
  return (
    <IconButton
      testID={testID}
      icon={icon}
      accessibilityLabel={t('common.back')}
      onPress={onPress ?? (() => router.back())}
    />
  );
}
