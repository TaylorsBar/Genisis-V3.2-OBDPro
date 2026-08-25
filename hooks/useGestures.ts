import { useCallback, useRef } from 'react';

interface GestureOptions {
    onLongPress?: () => void;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    longPressDelay?: number;
    swipeThreshold?: number;
    edgeSwipeOnly?: boolean;
    edgeThreshold?: number;
}

export const useGestures = ({
    onLongPress,
    onSwipeLeft,
    onSwipeRight,
    longPressDelay = 1000,
    swipeThreshold = 80,
    edgeSwipeOnly = true,
    edgeThreshold = 80
}: GestureOptions) => {
    const timeout = useRef<NodeJS.Timeout>();
    const startPos = useRef<{ x: number, y: number } | null>(null);
    const currentPos = useRef<{ x: number, y: number } | null>(null);

    const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        // Prevent swipe on interactive elements
        const target = e.target as HTMLElement;
        
        // Helper to check if any parent is scrollable
        const isScrollable = (el: HTMLElement | null): boolean => {
            if (!el || el === document.body) return false;
            if (el.scrollWidth > el.clientWidth) {
                const overflow = window.getComputedStyle(el).overflowX;
                if (overflow === 'auto' || overflow === 'scroll') return true;
            }
            return isScrollable(el.parentElement);
        };

        if (
            target.closest('.no-swipe') || 
            target.closest('input[type="range"]') || 
            target.closest('.js-plotly-plot') ||
            target.closest('.scrollable-x') || // any custom scrollable container
            target.tagName.toLowerCase() === 'input' ||
            target.tagName.toLowerCase() === 'textarea' ||
            target.tagName.toLowerCase() === 'button' ||
            target.closest('nav') ||
            target.closest('header') ||
            target.closest('[role="slider"]') ||
            target.closest('canvas') || // prevent 3d map swipes
            isScrollable(target)
        ) {
            return;
        }

        let x, y;
        if ('touches' in e) {
            x = e.touches[0].clientX;
            y = e.touches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        startPos.current = { x, y };
        currentPos.current = { x, y };

        if (onLongPress) {
            timeout.current = setTimeout(() => {
                onLongPress();
                startPos.current = null; // Prevent swipe after long press
            }, longPressDelay);
        }
    }, [onLongPress, longPressDelay]);

    const clear = useCallback(() => {
        if (timeout.current) {
            clearTimeout(timeout.current);
        }
    }, []);

    const move = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        if (!startPos.current) return;

        let x, y;
        if ('touches' in e) {
            x = e.touches[0].clientX;
            y = e.touches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        currentPos.current = { x, y };

        const dx = x - startPos.current.x;
        const dy = y - startPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Cancel long press if moved too much
        if (distance > 15 && timeout.current) {
            clearTimeout(timeout.current);
            timeout.current = undefined;
        }
    }, []);

    const end = useCallback(() => {
        clear();
        if (startPos.current && currentPos.current) {
            const dx = currentPos.current.x - startPos.current.x;
            const dy = currentPos.current.y - startPos.current.y;
            
            // Check if it's mostly horizontal
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > swipeThreshold) {
                const startX = startPos.current.x;
                const width = window.innerWidth;
                
                if (edgeSwipeOnly) {
                    const isLeftEdge = startX <= edgeThreshold;
                    const isRightEdge = startX >= width - edgeThreshold;
                    
                    if (dx > 0 && isLeftEdge && onSwipeRight) {
                        onSwipeRight();
                    } else if (dx < 0 && isRightEdge && onSwipeLeft) {
                        onSwipeLeft();
                    }
                } else {
                    if (dx > 0 && onSwipeRight) {
                        onSwipeRight();
                    } else if (dx < 0 && onSwipeLeft) {
                        onSwipeLeft();
                    }
                }
            }
        }
        startPos.current = null;
        currentPos.current = null;
    }, [clear, onSwipeLeft, onSwipeRight, swipeThreshold, edgeSwipeOnly, edgeThreshold]);

    return {
        onMouseDown: start,
        onTouchStart: start,
        onMouseUp: end,
        onMouseLeave: end,
        onTouchEnd: end,
        onTouchCancel: end,
        onTouchMove: move,
        onMouseMove: move
    };
};
