import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSharedValue, withTiming, SharedValue, Easing } from 'react-native-reanimated';

// Cartouche flottante : 0 = visible, 1 = repliée (glissée sous l'écran).
// Les onglets branchent `onScroll` sur leur ScrollView/FlatList principal
// (avec scrollEventThrottle={16}) — le repli suit la direction du scroll.

type TabBarContextType = {
  hidden: SharedValue<number> | null;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const TabBarContext = createContext<TabBarContextType>({
  hidden: null,
  onScroll: () => {},
});

export function useTabBar() {
  return useContext(TabBarContext);
}

const SHOW_ANIM = { duration: 240, easing: Easing.out(Easing.cubic) };
const HIDE_ANIM = { duration: 280, easing: Easing.out(Easing.cubic) };
const THRESHOLD = 8;   // delta minimal pour réagir (anti-jitter)
const TOP_ZONE = 24;   // près du haut : toujours visible

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const hidden = useSharedValue(0);
  const lastY = useRef(0);
  const isHiddenRef = useRef(false);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const maxY = e.nativeEvent.contentSize.height - e.nativeEvent.layoutMeasurement.height;
    const dy = y - lastY.current;
    lastY.current = y;

    // Zones de rebond iOS : ignorer
    if (y < 0 || (maxY > 0 && y > maxY)) return;

    if (y <= TOP_ZONE) {
      if (isHiddenRef.current) {
        isHiddenRef.current = false;
        hidden.value = withTiming(0, SHOW_ANIM);
      }
      return;
    }

    if (dy > THRESHOLD && !isHiddenRef.current) {
      isHiddenRef.current = true;
      hidden.value = withTiming(1, HIDE_ANIM);
    } else if (dy < -THRESHOLD && isHiddenRef.current) {
      isHiddenRef.current = false;
      hidden.value = withTiming(0, SHOW_ANIM);
    }
  }, []);

  const value = useMemo(() => ({ hidden, onScroll }), [onScroll]);

  return (
    <TabBarContext.Provider value={value}>
      {children}
    </TabBarContext.Provider>
  );
}
