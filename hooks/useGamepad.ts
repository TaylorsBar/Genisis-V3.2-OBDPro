import { useEffect, useRef, useState } from 'react';

const getFocusableElements = (): HTMLElement[] => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ));
    return elements.filter(el => {
        const rect = el.getBoundingClientRect();
        // Check if visible and not disabled
        return rect.width > 0 && rect.height > 0 && !(el as any).disabled && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).opacity !== '0';
    });
};

const navigate = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    const focusable = getFocusableElements();
    if (focusable.length === 0) return;

    const current = document.activeElement as HTMLElement;
    if (!current || current === document.body || !focusable.includes(current)) {
        focusable[0].focus();
        return;
    }

    const currentRect = current.getBoundingClientRect();
    const currentCenter = {
        x: currentRect.left + currentRect.width / 2,
        y: currentRect.top + currentRect.height / 2
    };

    let bestMatch: HTMLElement | null = null;
    let minDistance = Infinity;

    focusable.forEach(el => {
        if (el === current) return;
        const rect = el.getBoundingClientRect();
        const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };

        let isValid = false;
        let primaryDist = 0;
        let secondaryDist = 0;

        switch (direction) {
            case 'UP':
                isValid = center.y < currentCenter.y;
                primaryDist = currentCenter.y - center.y;
                secondaryDist = Math.abs(currentCenter.x - center.x);
                break;
            case 'DOWN':
                isValid = center.y > currentCenter.y;
                primaryDist = center.y - currentCenter.y;
                secondaryDist = Math.abs(currentCenter.x - center.x);
                break;
            case 'LEFT':
                isValid = center.x < currentCenter.x;
                primaryDist = currentCenter.x - center.x;
                secondaryDist = Math.abs(currentCenter.y - center.y);
                break;
            case 'RIGHT':
                isValid = center.x > currentCenter.x;
                primaryDist = center.x - currentCenter.x;
                secondaryDist = Math.abs(currentCenter.y - center.y);
                break;
        }

        if (isValid) {
            // Cone constraint: secondary distance shouldn't be vastly larger than primary distance
            if (secondaryDist > primaryDist * 2) return;

            const distance = primaryDist + secondaryDist * 3; // Heavily weight secondary to prefer straight lines
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = el;
            }
        }
    });

    if (bestMatch) {
        (bestMatch as HTMLElement).focus();
        (bestMatch as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
};

export const useGamepad = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [gamepadName, setGamepadName] = useState<string | null>(null);
    const requestRef = useRef<number>();
    const lastActionTime = useRef<number>(0);
    const COOLDOWN_MS = 200; // Prevent rapid-fire movement

    const updateStatus = () => {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let activeGamepad: Gamepad | null = null;

        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                activeGamepad = gamepads[i];
                break;
            }
        }

        if (activeGamepad) {
            if (!isConnected) {
                setIsConnected(true);
                setGamepadName(activeGamepad.id);
                document.body.classList.add('gamepad-active');
            }

            const now = performance.now();
            if (now - lastActionTime.current > COOLDOWN_MS) {
                let actionTaken = false;

                // D-Pad or Left Stick
                const up = activeGamepad.buttons[12]?.pressed || activeGamepad.axes[1] < -0.5;
                const down = activeGamepad.buttons[13]?.pressed || activeGamepad.axes[1] > 0.5;
                const left = activeGamepad.buttons[14]?.pressed || activeGamepad.axes[0] < -0.5;
                const right = activeGamepad.buttons[15]?.pressed || activeGamepad.axes[0] > 0.5;
                
                // A Button (Select)
                const aButton = activeGamepad.buttons[0]?.pressed;
                // B Button (Back)
                const bButton = activeGamepad.buttons[1]?.pressed;

                if (up) { navigate('UP'); actionTaken = true; }
                else if (down) { navigate('DOWN'); actionTaken = true; }
                else if (left) { navigate('LEFT'); actionTaken = true; }
                else if (right) { navigate('RIGHT'); actionTaken = true; }
                else if (aButton) {
                    if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.click();
                    }
                    actionTaken = true;
                } else if (bButton) {
                    if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                    }
                    actionTaken = true;
                }

                if (actionTaken) {
                    lastActionTime.current = now;
                }
            }

            // Continuous Right Stick checking (no cooldown)
            if (activeGamepad.axes.length >= 4) {
                const rsX = activeGamepad.axes[2];
                const rsY = activeGamepad.axes[3];
                // Deadzone
                if (Math.abs(rsX) > 0.1) {
                    window.dispatchEvent(new CustomEvent('gamepad:axis', { detail: { axis: 2, value: rsX } }));
                }
                if (Math.abs(rsY) > 0.1) {
                    window.dispatchEvent(new CustomEvent('gamepad:axis', { detail: { axis: 3, value: rsY } }));
                }
            }
        } else {
            if (isConnected) {
                setIsConnected(false);
                setGamepadName(null);
                document.body.classList.remove('gamepad-active');
            }
        }

        requestRef.current = requestAnimationFrame(updateStatus);
    };

    useEffect(() => {
        const handleConnect = (e: GamepadEvent) => {
            console.log("Gamepad connected:", e.gamepad.id);
            setIsConnected(true);
            setGamepadName(e.gamepad.id);
            document.body.classList.add('gamepad-active');
        };
        const handleDisconnect = (e: GamepadEvent) => {
            console.log("Gamepad disconnected:", e.gamepad.id);
            setIsConnected(false);
            setGamepadName(null);
            document.body.classList.remove('gamepad-active');
        };

        window.addEventListener("gamepadconnected", handleConnect);
        window.addEventListener("gamepaddisconnected", handleDisconnect);

        requestRef.current = requestAnimationFrame(updateStatus);

        return () => {
            window.removeEventListener("gamepadconnected", handleConnect);
            window.removeEventListener("gamepaddisconnected", handleDisconnect);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            document.body.classList.remove('gamepad-active');
        };
    }, [isConnected]);

    return { isConnected, gamepadName };
};
