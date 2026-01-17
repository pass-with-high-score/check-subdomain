'use client';

import { useState, useCallback } from 'react';
import { useSkinBuilder } from '@/lib/contexts/SkinBuilderContext';
import { MotionState, AnimationItem, Asset } from '@/lib/types/skin';
import { TrashIcon, PlusIcon, RefreshIcon } from '@/components/Icons';
import styles from '../page.module.css';

interface StateEditorModalProps {
    stateId: string;
    onClose: () => void;
}

export default function StateEditorModal({ stateId, onClose }: StateEditorModalProps) {
    const { state, updateState, getAssetByFilename } = useSkinBuilder();
    const currentState = state.skinData.states.find(s => s.state === stateId);

    const [editedState, setEditedState] = useState<MotionState>(
        currentState || { state: stateId, items: [] }
    );
    const [showAssetPicker, setShowAssetPicker] = useState(false);
    const [targetRepeatPath, setTargetRepeatPath] = useState<number[] | null>(null); // null = add to root, array = path to repeat-item

    const handleAddFrame = useCallback((asset: Asset) => {
        const newItem: AnimationItem = {
            type: 'item',
            drawable: asset.filename.replace(/\.(png|jpg|jpeg|gif)$/i, ''),
            duration: 250,
        };

        if (targetRepeatPath === null) {
            // Add to root
            setEditedState(prev => ({
                ...prev,
                items: [...prev.items, newItem],
            }));
        } else {
            // Add to specific repeat-item
            setEditedState(prev => ({
                ...prev,
                items: addItemToPath(prev.items, targetRepeatPath, newItem),
            }));
        }
        setShowAssetPicker(false);
        setTargetRepeatPath(null);
    }, [targetRepeatPath]);

    // Helper to add item to a repeat-item at given path
    const addItemToPath = (items: AnimationItem[], path: number[], newItem: AnimationItem): AnimationItem[] => {
        if (path.length === 0) return [...items, newItem];
        const [first, ...rest] = path;
        return items.map((item, i) => {
            if (i !== first) return item;
            if (rest.length === 0 && item.type === 'repeat-item') {
                return { ...item, items: [...(item.items || []), newItem] };
            }
            if (item.type === 'repeat-item' && item.items) {
                return { ...item, items: addItemToPath(item.items, rest, newItem) };
            }
            return item;
        });
    };

    // Helper to update nested items by path
    const updateItemAtPath = (items: AnimationItem[], path: number[], updater: (item: AnimationItem) => AnimationItem | null): AnimationItem[] => {
        if (path.length === 0) return items;
        const [first, ...rest] = path;
        return items.map((item, i) => {
            if (i !== first) return item;
            if (rest.length === 0) {
                const result = updater(item);
                return result; // may be null for removal
            }
            if (item.type === 'repeat-item' && item.items) {
                return { ...item, items: updateItemAtPath(item.items, rest, updater) };
            }
            return item;
        }).filter((item): item is AnimationItem => item !== null);
    };

    const handleRemoveItem = useCallback((path: number[]) => {
        setEditedState(prev => ({
            ...prev,
            items: updateItemAtPath(prev.items, path, () => null),
        }));
    }, []);

    const handleUpdateDuration = useCallback((path: number[], duration: number) => {
        setEditedState(prev => ({
            ...prev,
            items: updateItemAtPath(prev.items, path, (item) => ({ ...item, duration })),
        }));
    }, []);

    const handleUpdateRepeatCount = useCallback((path: number[], repeatCount: number) => {
        setEditedState(prev => ({
            ...prev,
            items: updateItemAtPath(prev.items, path, (item) => ({ ...item, repeatCount })),
        }));
    }, []);

    const handleAddRepeatItem = useCallback((targetPath?: number[]) => {
        const newRepeat: AnimationItem = {
            type: 'repeat-item',
            repeatCount: 2,
            items: [],
        };

        if (targetPath === undefined) {
            // Add to root
            setEditedState(prev => ({
                ...prev,
                items: [...prev.items, newRepeat],
            }));
        } else {
            // Add to specific repeat-item
            setEditedState(prev => ({
                ...prev,
                items: addItemToPath(prev.items, targetPath, newRepeat),
            }));
        }
    }, []);

    const handleSave = useCallback(() => {
        updateState(editedState);
        onClose();
    }, [editedState, updateState, onClose]);

    // Count total frames (for display)
    const countTotalFrames = (items: AnimationItem[]): number => {
        let count = 0;
        for (const item of items) {
            if (item.type === 'item') {
                count++;
            } else if (item.type === 'repeat-item' && item.items) {
                count += countTotalFrames(item.items);
            }
        }
        return count;
    };

    // Render items hierarchically
    const renderItems = (items: AnimationItem[], parentPath: number[] = []) => {
        return items.map((item, idx) => {
            const currentPath = [...parentPath, idx];

            if (item.type === 'item') {
                const asset = getAssetByFilename(item.drawable || '');
                return (
                    <div key={currentPath.join('-')} className={styles.frameItem}>
                        {asset ? (
                            <img src={asset.dataUrl} alt={item.drawable} />
                        ) : (
                            <div style={{ width: 48, height: 48, background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>
                                {item.drawable}
                            </div>
                        )}
                        <input
                            type="number"
                            value={item.duration || 250}
                            onChange={(e) => handleUpdateDuration(currentPath, Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 50, padding: '0.2rem', fontSize: '0.7rem', textAlign: 'center', border: '2px solid var(--neo-black)' }}
                        />
                        <span className={styles.frameDuration}>ms</span>
                        <button
                            onClick={() => handleRemoveItem(currentPath)}
                            style={{ background: 'var(--neo-red)', color: 'white', border: 'none', cursor: 'pointer', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                        >
                            <TrashIcon size={10} />
                        </button>
                    </div>
                );
            } else if (item.type === 'repeat-item') {
                return (
                    <div key={currentPath.join('-')} className={styles.repeatGroup}>
                        <div className={styles.repeatHeader}>
                            <RefreshIcon size={14} />
                            <span>Repeat</span>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={item.repeatCount || 1}
                                onChange={(e) => handleUpdateRepeatCount(currentPath, Number(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: 40, padding: '0.2rem', fontSize: '0.7rem', textAlign: 'center', border: '2px solid var(--neo-black)' }}
                            />
                            <span style={{ fontSize: '0.7rem' }}>times</span>
                            <button
                                onClick={() => handleRemoveItem(currentPath)}
                                style={{ background: 'var(--neo-red)', color: 'white', border: 'none', cursor: 'pointer', padding: '0.2rem 0.4rem', fontSize: '0.7rem', marginLeft: 'auto' }}
                            >
                                <TrashIcon size={10} />
                            </button>
                        </div>
                        <div className={styles.repeatContent}>
                            {item.items && renderItems(item.items, currentPath)}
                            <button
                                className={styles.addFrameBtnSmall}
                                onClick={() => {
                                    setTargetRepeatPath(currentPath);
                                    setShowAssetPicker(true);
                                }}
                                title="Add frame to this repeat group"
                            >
                                <PlusIcon size={14} />
                            </button>
                            <button
                                className={styles.addFrameBtnSmall}
                                onClick={() => handleAddRepeatItem(currentPath)}
                                title="Add nested repeat group"
                                style={{ background: 'var(--neo-purple)' }}
                            >
                                <RefreshIcon size={14} />
                            </button>
                        </div>
                    </div>
                );
            }
            return null;
        });
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                <div className={styles.modalHeader}>
                    <span className={styles.modalTitle}>Edit: {stateId}</span>
                    <button className={styles.modalClose} onClick={onClose}>×</button>
                </div>
                <div className={styles.modalContent}>
                    {/* Frame Timeline */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                            Animation Items ({countTotalFrames(editedState.items)} frames)
                        </label>
                        <button
                            onClick={() => handleAddRepeatItem()}
                            className={styles.btn}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                            <RefreshIcon size={12} /> Add Repeat Group
                        </button>
                    </div>
                    <div className={styles.frameTimeline}>
                        {renderItems(editedState.items)}
                        <button
                            className={styles.addFrameBtn}
                            onClick={() => {
                                setTargetRepeatPath(null);
                                setShowAssetPicker(true);
                            }}
                            title="Add frame"
                        >
                            <PlusIcon size={20} />
                        </button>
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.btn} onClick={onClose}>Cancel</button>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Asset Picker Modal */}
            {showAssetPicker && (
                <div className={styles.modalOverlay} onClick={() => { setShowAssetPicker(false); setTargetRepeatPath(null); }} style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle}>
                                Select Sprite {targetRepeatPath !== null && '(for repeat group)'}
                            </span>
                            <button className={styles.modalClose} onClick={() => { setShowAssetPicker(false); setTargetRepeatPath(null); }}>×</button>
                        </div>
                        <div className={styles.modalContent}>
                            {state.skinData.assets.length > 0 ? (
                                <div className={styles.assetsGrid}>
                                    {state.skinData.assets.map((asset) => (
                                        <div
                                            key={asset.id}
                                            className={styles.assetItem}
                                            onClick={() => handleAddFrame(asset)}
                                            title={asset.filename}
                                        >
                                            <img src={asset.dataUrl} alt={asset.filename} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.emptyState}>
                                    <p>No assets uploaded yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
