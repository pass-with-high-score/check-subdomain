'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSkinBuilder } from '@/lib/contexts/SkinBuilderContext';
import { SimulationEngine, SimulatorConfig, Behaviour } from '@/lib/utils/simulationEngine';
import { XIcon } from '@/components/Icons';
import styles from '../page.module.css';

interface MobileSimulatorProps {
    onClose: () => void;
}

const MOBILE_PRESETS = {
    'pixel7': { name: 'Pixel 7', width: 412, height: 915 },
    'pixel8': { name: 'Pixel 8', width: 412, height: 932 },
    'galaxys23': { name: 'Galaxy S23', width: 360, height: 780 },
    'galaxys24': { name: 'Galaxy S24', width: 360, height: 800 },
    'oneplus12': { name: 'OnePlus 12', width: 412, height: 920 },
    'custom': { name: 'Custom', width: 360, height: 640 },
};

export default function MobileSimulator({ onClose }: MobileSimulatorProps) {
    const { state, getAssetByFilename } = useSkinBuilder();
    const canvasRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<SimulationEngine | null>(null);
    const animationRef = useRef<number>(undefined);
    const frameTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const [isRunning, setIsRunning] = useState(false);
    const [preset, setPreset] = useState<keyof typeof MOBILE_PRESETS>('pixel7');
    const [config, setConfig] = useState<SimulatorConfig>({
        displayWidth: MOBILE_PRESETS.pixel7.width,
        displayHeight: MOBILE_PRESETS.pixel7.height,
        spriteSize: 80,
        speedFactor: 1.0,
        behaviour: 'whimsical',
    });

    const [simState, setSimState] = useState({
        x: config.displayWidth / 2,
        y: config.displayHeight / 2,
        currentState: '',
        currentDrawable: '',
    });

    // Initialize engine
    useEffect(() => {
        if (state.skinData.states.length === 0) return;

        engineRef.current = new SimulationEngine(state.skinData, config);
        const engineState = engineRef.current.getState();
        setSimState({
            x: engineState.curX,
            y: engineState.curY,
            currentState: engineState.currentState,
            currentDrawable: engineRef.current.getCurrentDrawable() || '',
        });
    }, [state.skinData, config.displayWidth, config.displayHeight]);

    // Update engine config
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.setConfig(config);
        }
    }, [config]);

    // Animation loop
    useEffect(() => {
        if (!isRunning || !engineRef.current) return;

        const runTick = () => {
            if (!engineRef.current) return;

            engineRef.current.tick();
            const engineState = engineRef.current.getState();

            setSimState({
                x: engineState.curX,
                y: engineState.curY,
                currentState: engineState.currentState,
                currentDrawable: engineRef.current.getCurrentDrawable() || '',
            });

            animationRef.current = requestAnimationFrame(runTick);
        };

        const intervalId = setInterval(() => {
            if (engineRef.current) {
                engineRef.current.tick();
            }
        }, engineRef.current.getAnimationInterval());

        // Frame animation timer
        const advanceFrame = () => {
            if (!engineRef.current || !isRunning) return;

            const duration = engineRef.current.getCurrentDuration();
            engineRef.current.nextFrame();

            const engineState = engineRef.current.getState();
            setSimState(prev => ({
                ...prev,
                currentDrawable: engineRef.current?.getCurrentDrawable() || '',
            }));

            frameTimerRef.current = setTimeout(advanceFrame, duration / config.speedFactor);
        };

        frameTimerRef.current = setTimeout(advanceFrame, engineRef.current.getCurrentDuration() / config.speedFactor);

        // Position update loop
        const updatePosition = () => {
            if (!engineRef.current || !isRunning) return;

            const engineState = engineRef.current.getState();
            setSimState(prev => ({
                ...prev,
                x: engineState.curX,
                y: engineState.curY,
                currentState: engineState.currentState,
            }));

            animationRef.current = requestAnimationFrame(updatePosition);
        };

        animationRef.current = requestAnimationFrame(updatePosition);

        return () => {
            clearInterval(intervalId);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (frameTimerRef.current) clearTimeout(frameTimerRef.current);
        };
    }, [isRunning, config.speedFactor]);

    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!engineRef.current || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = config.displayWidth / rect.width;
        const scaleY = config.displayHeight / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        engineRef.current.setTargetPosition(x, y);

        if (!isRunning) {
            setIsRunning(true);
        }
    }, [config.displayWidth, config.displayHeight, isRunning]);

    const handleReset = () => {
        if (engineRef.current) {
            engineRef.current.reset();
            const engineState = engineRef.current.getState();
            setSimState({
                x: engineState.curX,
                y: engineState.curY,
                currentState: engineState.currentState,
                currentDrawable: engineRef.current.getCurrentDrawable() || '',
            });
        }
        setIsRunning(false);
    };

    const handlePresetChange = (newPreset: keyof typeof MOBILE_PRESETS) => {
        setPreset(newPreset);
        const presetData = MOBILE_PRESETS[newPreset];
        setConfig(prev => ({
            ...prev,
            displayWidth: presetData.width,
            displayHeight: presetData.height,
        }));
    };

    const currentAsset = getAssetByFilename(simState.currentDrawable + '.png') ||
        getAssetByFilename(simState.currentDrawable);

    // Calculate scale to fit simulator in viewport
    const maxHeight = typeof window !== 'undefined' ? window.innerHeight * 0.6 : 600;
    const scale = Math.min(1, maxHeight / config.displayHeight, 400 / config.displayWidth);

    if (state.skinData.states.length === 0) {
        return (
            <div className={styles.modalOverlay} onClick={onClose}>
                <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                    <div className={styles.modalHeader}>
                        <span className={styles.modalTitle}>📱 Mobile Simulator</span>
                        <button className={styles.modalClose} onClick={onClose}>
                            <XIcon size={16} />
                        </button>
                    </div>
                    <div className={styles.modalContent}>
                        <div className={styles.emptyState}>
                            <p>No states defined. Add some states first to simulate.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.simulatorModal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <span className={styles.modalTitle}>📱 Mobile Simulator</span>
                    <button className={styles.modalClose} onClick={onClose}>
                        <XIcon size={16} />
                    </button>
                </div>

                <div className={styles.simulatorContent}>
                    {/* Settings Panel */}
                    <div className={styles.simulatorSettings}>
                        <div className={styles.formGroup}>
                            <label>Device</label>
                            <select
                                value={preset}
                                onChange={e => handlePresetChange(e.target.value as keyof typeof MOBILE_PRESETS)}
                            >
                                {Object.entries(MOBILE_PRESETS).map(([key, val]) => (
                                    <option key={key} value={key}>{val.name} ({val.width}×{val.height})</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Sprite Size: {config.spriteSize}px</label>
                            <input
                                type="range"
                                min="32"
                                max="160"
                                value={config.spriteSize}
                                onChange={e => setConfig(prev => ({ ...prev, spriteSize: Number(e.target.value) }))}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Speed: {config.speedFactor.toFixed(1)}x</label>
                            <input
                                type="range"
                                min="0.25"
                                max="3"
                                step="0.25"
                                value={config.speedFactor}
                                onChange={e => setConfig(prev => ({ ...prev, speedFactor: Number(e.target.value) }))}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Behaviour</label>
                            <select
                                value={config.behaviour}
                                onChange={e => setConfig(prev => ({ ...prev, behaviour: e.target.value as Behaviour }))}
                            >
                                <option value="closer">Closer (Follow)</option>
                                <option value="further">Further (Run Away)</option>
                                <option value="whimsical">Whimsical (Random)</option>
                            </select>
                        </div>

                        <div className={styles.simulatorControls}>
                            <button className={`${styles.btn} ${isRunning ? styles.btnDanger : styles.btnPrimary}`} onClick={() => setIsRunning(!isRunning)}>
                                {isRunning ? '⏸ Pause' : '▶ Play'}
                            </button>
                            <button className={styles.btn} onClick={handleReset}>
                                ↺ Reset
                            </button>
                        </div>

                        {/* Status */}
                        <div className={styles.simulatorStatus}>
                            <div><strong>State:</strong> {simState.currentState}</div>
                            <div><strong>Drawable:</strong> {simState.currentDrawable}</div>
                            <div><strong>Position:</strong> ({Math.round(simState.x)}, {Math.round(simState.y)})</div>
                        </div>
                    </div>

                    {/* Phone Frame */}
                    <div className={styles.phoneFrame}>
                        <div className={styles.phoneNotch}></div>
                        <div
                            ref={canvasRef}
                            className={styles.phoneScreen}
                            style={{
                                width: config.displayWidth * scale,
                                height: config.displayHeight * scale,
                            }}
                            onClick={handleCanvasClick}
                        >
                            {/* Sprite */}
                            {currentAsset && (
                                <div
                                    className={styles.simulatorSprite}
                                    style={{
                                        width: config.spriteSize * scale,
                                        height: config.spriteSize * scale,
                                        left: (simState.x - config.spriteSize / 2) * scale,
                                        top: (simState.y - config.spriteSize / 2) * scale,
                                    }}
                                >
                                    <img
                                        src={currentAsset.dataUrl}
                                        alt={simState.currentDrawable}
                                        style={{ imageRendering: 'pixelated' }}
                                    />
                                </div>
                            )}

                            {/* Click hint */}
                            <div className={styles.clickHint}>
                                Click anywhere to set target
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
