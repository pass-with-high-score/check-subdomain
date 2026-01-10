'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import Navigation from '@/components/Navigation';
import { SkinBuilderProvider, useSkinBuilder } from '@/lib/contexts/SkinBuilderContext';
import { importSkinFromZip } from '@/lib/utils/skinImport';
import { exportSkinToZip, downloadBlob } from '@/lib/utils/skinExport';
import AssetManager from './components/AssetManager';
import StateList from './components/StateList';
import StateEditorModal from './components/StateEditorModal';
import MetadataEditorModal from './components/MetadataEditorModal';
import AnimationPreview from './components/AnimationPreview';
import MobileSimulator from './components/MobileSimulator';
import { UploadIcon, DownloadIcon, SettingsIcon, SmartphoneIcon } from '@/components/Icons';
import styles from './page.module.css';

function SkinBuilderContent() {
    const { state, setMetadata, setSkinData, reset } = useSkinBuilder();
    const [editingStateId, setEditingStateId] = useState<string | null>(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showSimulator, setShowSimulator] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const skinData = await importSkinFromZip(file);
            setSkinData(skinData);
        } catch (error) {
            console.error('Import failed:', error);
            alert('Failed to import skin: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsImporting(false);
            if (importInputRef.current) {
                importInputRef.current.value = '';
            }
        }
    };

    const handleExport = async () => {
        if (state.skinData.assets.length === 0) {
            alert('Please add at least one asset before exporting.');
            return;
        }

        setIsExporting(true);
        try {
            const blob = await exportSkinToZip(state.skinData);
            const filename = `${state.skinData.metadata.name.replace(/[^a-zA-Z0-9]/g, '_')}_skin.zip`;
            downloadBlob(blob, filename);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export skin: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsExporting(false);
        }
    };

    const handleReset = () => {
        if (confirm('Are you sure you want to reset? All changes will be lost.')) {
            reset();
        }
    };

    return (
        <div className={styles.pageContainer}>
            <Navigation />

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.logoBox}>
                        <Image src="/aneko.png" alt="ANeko" width={28} height={28} style={{ imageRendering: 'smooth' }} />
                    </div>
                    <h1 className={styles.title}>ANeko Builder</h1>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={styles.btn}
                        onClick={() => importInputRef.current?.click()}
                        disabled={isImporting}
                    >
                        <UploadIcon size={16} />
                        {isImporting ? 'Importing...' : 'Import'}
                    </button>
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".zip"
                        style={{ display: 'none' }}
                        onChange={handleImport}
                    />
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        <DownloadIcon size={16} />
                        {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                    <button
                        className={styles.btn}
                        onClick={() => setShowSettingsModal(true)}
                    >
                        <SettingsIcon size={16} />
                        Advanced
                    </button>
                    <button
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() => setShowSimulator(true)}
                    >
                        <SmartphoneIcon size={16} />
                        Simulate
                    </button>
                </div>
            </header>

            {/* Metadata Row */}
            <div className={styles.metadataRow}>
                <div className={styles.metadataField}>
                    <label>Skin Name</label>
                    <input
                        type="text"
                        value={state.skinData.metadata.name}
                        onChange={(e) => setMetadata({ name: e.target.value })}
                        placeholder="My Skin"
                    />
                </div>
                <div className={styles.metadataField}>
                    <label>Author</label>
                    <input
                        type="text"
                        value={state.skinData.metadata.author}
                        onChange={(e) => setMetadata({ author: e.target.value })}
                        placeholder="Your Name"
                    />
                </div>
                <div className={styles.metadataField}>
                    <label>Package Name</label>
                    <input
                        type="text"
                        value={state.skinData.metadata.package}
                        onChange={(e) => setMetadata({ package: e.target.value })}
                        placeholder="com.example.myskin"
                    />
                </div>
                <div className={styles.metadataField}>
                    <label>Icon (Preview)</label>
                    <input
                        type="text"
                        value={state.skinData.metadata.preview}
                        onChange={(e) => setMetadata({ preview: e.target.value })}
                        placeholder="icon"
                    />
                </div>
            </div>

            {/* Main Grid */}
            <div className={styles.mainGrid}>
                <AssetManager />
                <StateList onEditState={(stateId) => setEditingStateId(stateId)} />
                <AnimationPreview />
            </div>

            {/* Keyboard Hint */}
            <div className={styles.keyboardHint}>
                Press <kbd>⌘</kbd><kbd>K</kbd> for shortcuts
            </div>

            {/* Modals */}
            {editingStateId && (
                <StateEditorModal
                    stateId={editingStateId}
                    onClose={() => setEditingStateId(null)}
                />
            )}

            {showSettingsModal && (
                <MetadataEditorModal onClose={() => setShowSettingsModal(false)} />
            )}

            {showSimulator && (
                <MobileSimulator onClose={() => setShowSimulator(false)} />
            )}
        </div>
    );
}

export default function ANekoBuilderPage() {
    return (
        <SkinBuilderProvider>
            <SkinBuilderContent />
        </SkinBuilderProvider>
    );
}
