import { useState, useEffect, useCallback, RefObject } from 'react';

export interface VirtualItem {
  index: number;
  offsetTop: number;
}

export interface UseVirtualListOptions {
  itemsCount: number;
  itemHeight?: number;
  overscan?: number;
}

export interface UseVirtualListResult {
  virtualItems: VirtualItem[];
  totalHeight: number;
  paddingTop: number;
  paddingBottom: number;
  isVirtualizing: boolean;
}

/**
 * Hook de virtualización de alto rendimiento sin dependencias externas.
 * Renderiza dinámicamente solo las filas visibles dentro del contenedor scrolleable,
 * aplicando un buffer (overscan) para mantener un movimiento suave a 60 FPS.
 */
export function useVirtualList(
  containerRef: RefObject<HTMLElement | null>,
  options: UseVirtualListOptions,
): UseVirtualListResult {
  const { itemsCount, itemHeight = 44, overscan = 5 } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;
    setScrollTop(containerRef.current.scrollTop);
    setContainerHeight(containerRef.current.clientHeight || 600);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rAFId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rAFId);
      rAFId = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop);
      });
    };

    const handleResize = () => {
      updateDimensions();
    };

    updateDimensions();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      cancelAnimationFrame(rAFId);
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef, updateDimensions]);

  // Solo virtualiza cuando la cantidad de filas sea mayor a 15
  const isVirtualizing = itemsCount > 15;

  if (!isVirtualizing) {
    const virtualItems: VirtualItem[] = Array.from({ length: itemsCount }, (_, index) => ({
      index,
      offsetTop: index * itemHeight,
    }));
    return {
      virtualItems,
      totalHeight: itemsCount * itemHeight,
      paddingTop: 0,
      paddingBottom: 0,
      isVirtualizing: false,
    };
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    itemsCount - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
  );

  const virtualItems: VirtualItem[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    virtualItems.push({
      index: i,
      offsetTop: i * itemHeight,
    });
  }

  const paddingTop = startIndex * itemHeight;
  const paddingBottom = Math.max(0, (itemsCount - 1 - endIndex) * itemHeight);
  const totalHeight = itemsCount * itemHeight;

  return {
    virtualItems,
    totalHeight,
    paddingTop,
    paddingBottom,
    isVirtualizing: true,
  };
}
