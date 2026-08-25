import { useCallback, useRef } from 'react';

export const useLongPress = (
    onLongPress: () => void,
    delay: number = 2000,
    moveThreshold: number = 15
) => {
    const timeout = useRef<NodeJS.Timeout>();
    const startPos = useRef<{ x: number, y: number } | null>(null);

    const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        if ('touches' in e) {
            startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else {
            startPos.current = { x: e.clientX, y: e.clientY };
        }

        timeout.current = setTimeout(() => {
            onLongPress();
        }, delay);
    }, [onLongPress, delay]);

    const clear = useCallback(() => {
        if (timeout.current) {
            clearTimeout(timeout.current);
        }
        startPos.current = null;
    }, []);

    const move = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        if (!startPos.current || !timeout.current) return;

        let currentX, currentY;
        if ('touches' in e) {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        const dx = currentX - startPos.current.x;
        const dy = currentY - startPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > moveThreshold) {
            clear();
        }
    }, [clear, moveThreshold]);

    return {
        onMouseDown: start,
        onTouchStart: start,
        onMouseUp: clear,
        onMouseLeave: clear,
        onTouchEnd: clear,
        onTouchCancel: clear,
        onTouchMove: move,
        onMouseMove: move
    };
};
