import React, { createContext, useContext } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

// Shared animated value for parallax communication between SwipeBackPage and TabLayout
// 0 = no swipe active (or page fully covering), 1 = page fully swiped away
const SwipeBackContext = createContext<SharedValue<number> | null>(null);

export function SwipeBackProvider({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(0);
  return (
    <SwipeBackContext.Provider value={progress}>
      {children}
    </SwipeBackContext.Provider>
  );
}

export function useSwipeBackProgress(): SharedValue<number> | null {
  return useContext(SwipeBackContext);
}
