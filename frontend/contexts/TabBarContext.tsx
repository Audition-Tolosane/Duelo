import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSharedValue, withTiming, SharedValue, Easing } from 'react-native-reanimated';

// En-tête global + cartouche du bas : 0 = visibles, 1 = repliés.
// Les onglets branchent `onScroll` sur leur ScrollView/FlatList principal
// (avec scrollEventThrottle={16}) et décalent leur contenu de `headerHeight`
// (l'en-tête flotte PAR-DESSUS le contenu, voir app/(tabs)/_layout.tsx).
//
// Le repli SUIT LE DOIGT (comme Instagram) : chaque pixel défilé vers le bas cache un pixel
// d'en-tête, et inversement. À l'arrêt du défilement, il finit sa course vers l'état le plus
// proche. L'ancienne version déclenchait une animation tout-ou-rien qui changeait la
// HAUTEUR de l'en-tête : tout le contenu sautait de 50 px pendant qu'on défilait (saccadé).

type TabBarContextType = {
  hidden: SharedValue<number> | null;
  /** 0 = tout en haut de la page, 1 = page défilée (l'en-tête prend alors un fond). */
  scrolled: SharedValue<number> | null;
  /** Hauteur de l'en-tête global (zone caméra comprise) : marge haute du contenu des onglets. */
  headerHeight: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const TabBarContext = createContext<TabBarContextType>({
  hidden: null,
  scrolled: null,
  headerHeight: 0,
  onScroll: () => {},
});

export function useTabBar() {
  return useContext(TabBarContext);
}

const SNAP_ANIM = { duration: 200, easing: Easing.out(Easing.cubic) };
const SNAP_DELAY = 140;   // ms sans évènement de défilement = arrêt
const JUMP = 200;         // saut de position (changement d'onglet) : on ignore

export function TabBarProvider({ children, headerHeight }: { children: React.ReactNode; headerHeight: number }) {
  const hidden = useSharedValue(0);
  const scrolled = useSharedValue(0);
  const lastY = useRef(0);
  const hiddenJs = useRef(0);
  const scrolledJs = useRef(0);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // contentInset (iOS) : la page commence à -inset ; on ramène le haut à 0
    const y = e.nativeEvent.contentOffset.y + ((e.nativeEvent as any).contentInset?.top || 0);
    const maxY = e.nativeEvent.contentSize.height - e.nativeEvent.layoutMeasurement.height
      + ((e.nativeEvent as any).contentInset?.top || 0);
    const dy = y - lastY.current;
    lastY.current = y;

    const isScrolled = y > 2 ? 1 : 0;
    if (isScrolled !== scrolledJs.current) {
      scrolledJs.current = isScrolled;
      scrolled.value = withTiming(isScrolled, { duration: 180 });
    }

    // Rebonds iOS (au-dessus du haut / sous le bas) et sauts : pas de repli
    if (y < 0 || (maxY > 0 && y > maxY) || Math.abs(dy) > JUMP) return;

    const range = Math.max(1, headerHeight);
    let next = Math.min(1, Math.max(0, hiddenJs.current + dy / range));
    // Près du haut, l'en-tête ne peut pas être plus caché que ce qu'on a défilé
    if (y < range) next = Math.min(next, y / range);
    if (next !== hiddenJs.current) {
      hiddenJs.current = next;
      hidden.value = next;
    }

    // Arrêt du défilement : finir la course vers l'état le plus proche
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      const v = hiddenJs.current;
      if (v === 0 || v === 1) return;
      const target = v > 0.5 && lastY.current >= range ? 1 : 0;
      hiddenJs.current = target;
      hidden.value = withTiming(target, SNAP_ANIM);
    }, SNAP_DELAY);
  }, [headerHeight]);

  const value = useMemo(() => ({ hidden, scrolled, headerHeight, onScroll }), [onScroll, headerHeight]);

  return (
    <TabBarContext.Provider value={value}>
      {children}
    </TabBarContext.Provider>
  );
}
