'use client';

import { useState } from 'react';
import { useSkinBuilder } from '@/lib/contexts/SkinBuilderContext';
import { MotionParams } from '@/lib/types/skin';
import styles from '../page.module.css';

interface MetadataEditorModalProps {
    onClose: () => void;
}

export default function MetadataEditorModal({ onClose }: MetadataEditorModalProps) {
    const { state, setParams } = useSkinBuilder();
    const [editedParams, setEditedParams] = useState<MotionParams>({ ...state.skinData.params });

    const handleSave = () => {
        setParams(editedParams);
        onClose();
    };

    const handleChange = (key: keyof MotionParams, value: string | number) => {
        setEditedParams(prev => ({
            ...prev,
            [key]: typeof prev[key] === 'number' ? Number(value) : value,
        }));
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <span className={styles.modalTitle}>Advanced Settings</span>
                    <button className={styles.modalClose} onClick={onClose}>×</button>
                </div>
                <div className={styles.modalContent}>
                    <div className={styles.settingsGrid}>
                        <div className={styles.formGroup}>
                            <label>Acceleration</label>
                            <input
                                type="number"
                                value={editedParams.acceleration}
                                onChange={(e) => handleChange('acceleration', e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Max Velocity</label>
                            <input
                                type="number"
                                value={editedParams.maxVelocity}
                                onChange={(e) => handleChange('maxVelocity', e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Deacceleration Distance</label>
                            <input
                                type="number"
                                value={editedParams.deaccelerationDistance}
                                onChange={(e) => handleChange('deaccelerationDistance', e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Proximity Distance</label>
                            <input
                                type="number"
                                value={editedParams.proximityDistance}
                                onChange={(e) => handleChange('proximityDistance', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.btn} onClick={onClose}>Cancel</button>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
