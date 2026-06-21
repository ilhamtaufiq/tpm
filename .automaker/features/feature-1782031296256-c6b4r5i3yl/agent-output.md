
🔧 Tool: TodoWrite
Input: {
  "todos": [
    {
      "content": "Explore BarcodeScannerModal and related files",
      "status": "in_progress",
      "activeForm": "Exploring BarcodeScannerModal codebase"
    },
    {
      "content": "Plan implementation approach",
      "status": "pending",
      "activeForm": "Planning implementation approach"
    },
    {
      "content": "Implement red indicator for unmatched scans",
      "status": "pending",
      "activeForm": "Implementing red indicator for unmatched scans"
    },
    {
      "content": "Increase scan feedback volume (0.8-1.0)",
      "status": "pending",
      "activeForm": "Increasing scan feedback volume"
    },
    {
      "content": "Relabel scan mode: Conitunous -> Continuous -> Item Scan + i18n",
      "status": "pending",
      "activeForm": "Relabeling scan mode across all locales"
    },
    {
      "content": "Fix Code 128 barcode support",
      "status": "pending",
      "activeForm": "Fixing Code 128 barcode support"
    },
    {
      "content": "Add accessibility (aria-live, icons, WCAG AA)",
      "status": "pending",
      "activeForm": "Adding accessibility features"
    },
    {
      "content": "Handle edge cases (camera init failure, volume cap)",
      "status": "pending",
      "activeForm": "Handling edge cases"
    }
  ]
}

🔧 Tool: codegraph_explore
Input: {
  "query": "BarcodeScannerModal barcode scanner Html5Qrcode scan sound beep i18n locale continuous scan"
}

🔧 Tool: Glob
Input: {
  "pattern": "frontend/**/*Barcode*"
}

🔧 Tool: Glob
Input: {
  "pattern": "frontend/**/*barcode*"
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\BarcodeScannerModal.tsx"
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\Barcode.tsx"
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\utils\\sounds.ts"
}

🔧 Tool: Glob
Input: {
  "pattern": "frontend/**/i18n/**"
}

🔧 Tool: Glob
Input: {
  "pattern": "frontend/**/locales/**"
}

🔧 Tool: Glob
Input: {
  "pattern": "frontend/**/translations/**"
}

🔧 Tool: Glob
Input: {
  "pattern": "frontend/**/lang/**"
}

🔧 Tool: Grep
Input: {
  "pattern": "BarcodeScannerModal",
  "path": "C:\\laragon\\www\\tpm\\frontend",
  "include": "*.tsx,*.ts",
  "output_mode": "files_with_matches"
}

🔧 Tool: Grep
Input: {
  "pattern": "playSuccess|playError",
  "path": "C:\\laragon\\www\\tpm\\frontend",
  "include": "*.tsx,*.ts",
  "output_mode": "files_with_matches"
}

🔧 Tool: Grep
Input: {
  "pattern": "Conitunous",
  "path": "C:\\laragon\\www\\tpm\\frontend",
  "output_mode": "content",
  "-n": true
}

🔧 Tool: Grep
Input: {
  "pattern": "CONTINUOUS SCAN|continuous_scan|'continuous'",
  "path": "C:\\laragon\\www\\tpm\\frontend",
  "include": "*.tsx,*.ts",
  "output_mode": "files_with_matches"
}
I have the key files. Let me find where `onScan` is called from and locate i18n files.

🔧 Tool: Grep
Input: {
  "pattern": "BarcodeScannerModal",
  "path": "C:\\laragon\\www\\tpm\\frontend",
  "output_mode": "files_with_matches",
  "glob": "*.{tsx,ts}"
}

🔧 Tool: Grep
Input: {
  "pattern": "Conitunous|CONTINUOUS",
  "path": "C:\\laragon\\www\\tpm\\frontend",
  "output_mode": "content",
  "-n": true
}

🔧 Tool: Grep
Input: {
  "pattern": "playSuccess|playError",
  "path": "C:\\laragon\\www\\tpm\\frontend",
  "output_mode": "files_with_matches",
  "glob": "*.{tsx,ts}"
}

🔧 Tool: Grep
Input: {
  "pattern": "onScan|scanNotMatched|scanResult",
  "path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\BarcodeScannerModal.tsx",
  "output_mode": "content",
  "-n": true
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\BengkelForm.tsx",
  "offset": 1,
  "limit": 30
}

🔧 Tool: Grep
Input: {
  "-n": true,
  "pattern": "BarcodeScannerModal|onScan",
  "path": "C:\\laragon\\www\\tpm\\frontend\\components\\BengkelForm.tsx",
  "output_mode": "content",
  "-C": 5
}

🔧 Tool: Grep
Input: {
  "-n": true,
  "pattern": "BarcodeScannerModal|onScan",
  "path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\transaksi\\index.tsx",
  "output_mode": "content",
  "-C": 5
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\SparePartSelector.tsx"
}
Now let me check how sounds are used in the transaksi page and the scan handlers.

🔧 Tool: Grep
Input: {
  "-n": true,
  "pattern": "playSuccess|playError",
  "path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\transaksi\\index.tsx",
  "-C": 5,
  "output_mode": "content"
}

🔧 Tool: Grep
Input: {
  "-n": true,
  "pattern": "playSuccess|playError",
  "path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\BarcodeScannerModal.tsx",
  "-C": 5,
  "output_mode": "content"
}

🔧 Tool: Grep
Input: {
  "-n": true,
  "pattern": "handleScan|scanLog|setScanLog|scanned.*false|matched|notFound",
  "path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\transaksi\\index.tsx",
  "-C": 3,
  "output_mode": "content"
}

🔧 Tool: Grep
Input: {
  "-n": true,
  "pattern": "handleScanSparePart|handleScanPlate|playSuccess|playError|useScanSound",
  "path": "C:\\laragon\\www\\tpm\\frontend\\components\\BengkelForm.tsx",
  "-C": 8,
  "output_mode": "content"
}
Enough context gathered. Let me plan and implement.

🔧 Tool: TodoWrite
Input: {
  "todos": [
    {
      "content": "Explored BarcodeScannerModal, sounds.ts, all callers (BengkelForm, transaksi, SparePartSelector)",
      "status": "completed",
      "activeForm": "Exploring codebase"
    },
    {
      "activeForm": "Increasing scan feedback volume in sounds.ts",
      "content": "Increase scan feedback volume in sounds.ts (0.15→0.85 for web beep)",
      "status": "in_progress"
    },
    {
      "status": "pending",
      "activeForm": "Red indicator + async onScan + Code 128 fix + i18n relabel + a11y + edge cases",
      "content": "Rewrite BarcodeScannerModal: red indicator, async onScan, fix Code 128 fmt bug, ITEM SCAN rename, a11y aria-live, error handling, auto-dismiss"
    },
    {
      "status": "pending",
      "activeForm": "Updating BengkelForm scan handlers",
      "content": "Update BengkelForm.tsx scan handlers to return boolean, remove sound calls"
    },
    {
      "activeForm": "Updating transaksi scan handler",
      "content": "Update transaksi/index.tsx scan handler to return boolean, remove sound calls",
      "status": "pending"
    },
    {
      "content": "Update SparePartSelector.tsx scan handler to return boolean",
      "status": "pending",
      "activeForm": "Updating SparePartSelector scan handler"
    }
  ]
}
I see partial panel outputs mixed in. Let me continue directly with implementation.

Key findings from analysis:
- **Volume**: `gain.gain.setValueAtTime(0.15, ..)` → 0.85
- **Code 128 bug**: `formatsToSupport` uses `Html5QrcodeSupportedFormats.XXX` but it's renamed to `Fmts` in destructuring — undefined at runtime. That's why only QR works.
- **No match feedback path**: `onScan: (data: string) => void` — modal can't know if scan matched
- **Label typo**: "CONTINUOUS SCAN" in 2 places

Implementation plan:
1. Fix volume in `sounds.ts`
2. Fix Code 128 format enum bug in `BarcodeScannerModal.tsx`
3. Change `onScan` to return `boolean | Promise<boolean>` for match feedback
4. Add red "not found" indicator with auto-dismiss + icon
5. Rename "CONTINUOUS SCAN" → "ITEM SCAN"
6. Add aria-live for a11y
7. Update all callers (BengkelForm, transaksi, SparePartSelector)

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\utils\\sounds.ts",
  "offset": 70,
  "limit": 25
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\BarcodeScannerModal.tsx"
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\transaksi\\index.tsx",
  "offset": 460,
  "limit": 60
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\BengkelForm.tsx",
  "offset": 440,
  "limit": 100
}

🔧 Tool: TodoWrite
Input: {
  "todos": [
    {
      "activeForm": "Explored codebase",
      "content": "Explored BarcodeScannerModal, sounds.ts, all callers",
      "status": "completed"
    },
    {
      "activeForm": "Increasing scan feedback volume",
      "content": "Increase scan feedback volume in sounds.ts (0.15→0.85)",
      "status": "in_progress"
    },
    {
      "activeForm": "Rewriting BarcodeScannerModal",
      "content": "Rewrite BarcodeScannerModal: red indicator, async onScan, Code 128 fix, ITEM SCAN, a11y",
      "status": "pending"
    },
    {
      "activeForm": "Updating BengkelForm scan handlers",
      "content": "Update BengkelForm.tsx scan handlers - return boolean, remove sound calls",
      "status": "pending"
    },
    {
      "activeForm": "Updating transaksi scan handler",
      "content": "Update transaksi/index.tsx scan handler - return boolean, remove sound calls",
      "status": "pending"
    },
    {
      "activeForm": "Updating SparePartSelector scan handler",
      "content": "Update SparePartSelector.tsx scan handler - return boolean",
      "status": "pending"
    }
  ]
}

🔧 Tool: Edit
Input: {
  "replace_all": false,
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\utils\\sounds.ts",
  "old_string": "        gain.gain.setValueAtTime(0.15, ctx.currentTime);",
  "new_string": "        gain.gain.setValueAtTime(0.85, ctx.currentTime);"
}
**Facts for GateGuard:**

1. **Files importing `sounds.ts`** (confirmed via Grep):
   - `frontend/components/ui/BarcodeScannerModal.tsx` — imports `{ useScanSound, ensureAudioUnlocked }`
   - `frontend/app/bengkel/transaksi/index.tsx` — imports `{ useScanSound }`

2. **Public functions affected** — API signatures unchanged:
   - `useScanSound()` → `{ playSuccess, playError }`
   - `ensureAudioUnlocked()` — no change
   - `playWebBeep(freq, durationMs)` — internal, gain value `0.15` → `0.85`

3. **No data files read/written.** Pure audio utility — Web Audio API oscillator tones, no file I/O or data structures.

4. **User instruction verbatim**: Feature task item 2 — *"Raise beep/gain for both success and failure sounds to 0.8–1.0 range, avoiding clipping. Cap at system maximum (gain ≤ 1.0)."*

Retrying:

🔧 Tool: Edit
Input: {
  "replace_all": false,
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\utils\\sounds.ts",
  "old_string": "        gain.gain.setValueAtTime(0.15, ctx.currentTime);",
  "new_string": "        gain.gain.setValueAtTime(0.85, ctx.currentTime);"
}
Volume fix applied (0.15 → 0.85). Native beep already at max amplitude (`0x7FFF` = 32767, max 16-bit) — no change needed there.

Now main work: rewrite BarcodeScannerModal. Let me read the callers' sound usage more closely to plan the `onScan` contract change.

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\BengkelForm.tsx",
  "offset": 440,
  "limit": 100
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\transaksi\\index.tsx",
  "offset": 455,
  "limit": 60
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\SparePartSelector.tsx",
  "offset": 55,
  "limit": 10
}
Read issue. Let me re-fetch the scan handler code.

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\BengkelForm.tsx",
  "offset": 441,
  "limit": 85
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\transaksi\\index.tsx",
  "offset": 455,
  "limit": 55
}

🔧 Tool: Grep
Input: {
  "pattern": "handleScanSparePart",
  "-n": true,
  "-A": 80,
  "path": "C:\\laragon\\www\\tpm\\frontend\\components\\BengkelForm.tsx",
  "output_mode": "content"
}

🔧 Tool: Grep
Input: {
  "pattern": "const handleScan = async",
  "-n": true,
  "-A": 40,
  "path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\transaksi\\index.tsx",
  "output_mode": "content"
}

🔧 Tool: Grep
Input: {
  "pattern": "playSuccess|playError",
  "-n": true,
  "-C": 2,
  "path": "C:\\laragon\\www\\tpm\\frontend\\components\\BengkelForm.tsx",
  "output_mode": "content"
}

🔧 Tool: Grep
Input: {
  "-n": true,
  "pattern": "BarcodeScannerModal|onScan|handleScan",
  "path": "C:\\laragon\\www\\tpm\\frontend\\components\\forms\\SparepartForm.tsx",
  "-C": 3,
  "output_mode": "content"
}

🔧 Tool: Grep
Input: {
  "-n": true,
  "pattern": "BarcodeScannerModal|onScan|handleScan",
  "path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\inventory.tsx",
  "-C": 3,
  "output_mode": "content"
}

🔧 Tool: Grep
Input: {
  "-n": true,
  "pattern": "BarcodeScannerModal|onScan|handleScan",
  "path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\purchase\\create.tsx",
  "-C": 3,
  "output_mode": "content"
}

🔧 Tool: Grep
Input: {
  "-n": true,
  "pattern": "BarcodeScannerModal|onScan|handleScan",
  "path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\index.tsx",
  "-C": 3,
  "output_mode": "content"
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\BengkelForm.tsx",
  "limit": 40,
  "offset": 525
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\inventory.tsx",
  "limit": 35,
  "offset": 427
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\purchase\\create.tsx",
  "limit": 40,
  "offset": 256
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\app\\bengkel\\index.tsx",
  "limit": 10,
  "offset": 867
}
**Read Issue — Grep context sufficient. Proceeding with full implementation.**

Consensus from analysis:
1. **Volume 0.15→0.85** — done
2. **Code 128 bug**: line 160 uses `Html5QrcodeSupportedFormats` but local var is `Fmts` → `undefined` at runtime → only QR works
3. **onScan** must return `boolean | Promise<boolean>` for modal feedback
4. **CONTINUOUS→ITEM SCAN** rename + typo fix
5. **7 callers** to update

Let me write the full BarcodeScannerModal rewrite.

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\BarcodeScannerModal.tsx"
}
Implementing now. Three areas: volume fix already done, BarcodeScannerModal rewrite, caller updates.

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\utils\\sounds.ts",
  "offset": 74,
  "limit": 5
}

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\BarcodeScannerModal.tsx"
}
I see the panel started partial work. Let me continue and complete everything from where they left off — the full rewrite including Code 128 fix, ITEM SCAN rename, scanMatch indicator, a11y, camera error handling, and all caller updates.

Let me read the current state of the modal file to see what Source 1 already changed, then finish it.

🔧 Tool: Read
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\BarcodeScannerModal.tsx"
}
Acknowledged — file is unmodified. Proceeding with the full implementation now.

🔧 Tool: Write
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\BarcodeScannerModal.tsx",
  "content": "import React, { useState, useEffect, useRef, useMemo, useCallback, FC } from 'react';\nimport { View, StyleSheet, Pressable, SafeAreaView, StatusBar, Platform, TextInput, Animated } from 'react-native';\nimport AsyncStorage from '@react-native-async-storage/async-storage';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';\nimport { CameraView, useCameraPermissions } from 'expo-camera';\nimport { Typography } from './Typography';\nimport { X, Zap, ZapOff, Scan, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react-native';\nimport { Button } from './Button';\nimport { useScanSound, ensureAudioUnlocked } from '../../utils/sounds';\n\n// Dynamic import type for html5-qrcode (web only)\ntype Html5QrcodeType = any;\n\ntype ScanMatch = 'none' | 'match' | 'no-match';\n\ninterface BarcodeScannerModalProps {\n    visible: boolean;\n    onClose: () => void;\n    onScan: (data: string) => boolean | Promise<boolean>;\n    scanLog?: { id: string; title: string; subtitle?: string; timestamp: number }[];\n    continuous?: boolean;\n}\n\nexport const BarcodeScannerModal: FC<BarcodeScannerModalProps> = ({\n    visible,\n    onClose,\n    onScan,\n    scanLog = [],\n    continuous = false\n}) => {\n    const insets = useSafeAreaInsets();\n    const [permission, requestPermission] = useCameraPermissions();\n    const [scanned, setScanned] = useState(false);\n    const [torch, setTorch] = useState(false);\n    const [laserPos, setLaserPos] = useState(0);\n    const [movingDown, setMovingDown] = useState(true);\n    const [scannerMode, setScannerMode] = useState<'camera' | 'hardware' | 'web-camera'>('camera');\n    const [hwInput, setHwInput] = useState('');\n    const hwInputRef = useRef<TextInput>(null);\n\n    // html5-qrcode refs (web camera scanner)\n    const html5QrcodeRef = useRef<Html5QrcodeType>(null);\n    const webScannerContainerRef = useRef<View | null>(null);\n    const webScanInProgress = useRef(false);\n    const scannerPausedRef = useRef(false);\n\n    // Scan sound hook\n    const { playSuccess, playError } = useScanSound();\n\n    // Web camera error + flash indicator state\n    const [webCameraError, setWebCameraError] = useState<string | null>(null);\n    const [webFlashVisible, setWebFlashVisible] = useState(false);\n    const flashAnim = useRef(new Animated.Value(0)).current;\n\n    // Scan match indicator state\n    const [scanMatch, setScanMatch] = useState<ScanMatch>('none');\n    const scanMatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);\n\n    const triggerWebFlash = useCallback(() => {\n        setWebFlashVisible(true);\n        flashAnim.setValue(0);\n        Animated.timing(flashAnim, {\n            toValue: 1,\n            duration: 300,\n            useNativeDriver: true,\n        }).start(() => {\n            setWebFlashVisible(false);\n        });\n    }, [flashAnim]);\n\n    const showScanMatch = useCallback((match: ScanMatch) => {\n        if (scanMatchTimer.current) clearTimeout(scanMatchTimer.current);\n        setScanMatch(match);\n        scanMatchTimer.current = setTimeout(() => {\n            setScanMatch('none');\n        }, 1500);\n    }, []);\n\n    // Laser Animation Effect\n    useEffect(() => {\n        if (!visible) return;\n        const interval = setInterval(() => {\n            setLaserPos((prev: number) => {\n                if (movingDown) {\n                    if (prev >= 240) { setMovingDown(false); return 240; }\n                    return prev + 5;\n                } else {\n                    if (prev <= 10) { setMovingDown(true); return 10; }\n                    return prev - 5;\n                }\n            });\n        }, 30);\n        return () => clearInterval(interval);\n    }, [visible, movingDown]);\n\n    useEffect(() => {\n        let mounted = true;\n\n        const initializeScanner = async () => {\n            if (!mounted) return;\n\n            if (visible && !permission?.granted && scannerMode === 'camera') {\n                requestPermission();\n            }\n\n            // Load preferred mode\n            const saved = await AsyncStorage.getItem('@scanner_mode');\n            if (mounted && saved) setScannerMode(saved as any);\n        };\n\n        initializeScanner();\n\n        // Auto-focus hardware input if visible\n        if (visible) {\n            const timeoutId = setTimeout(() => hwInputRef.current?.focus(), 500);\n            return () => clearTimeout(timeoutId);\n        }\n\n        // Browser compatibility check for 1D barcodes\n        if (visible && Platform.OS === 'web' && (window as any).BarcodeDetector) {\n            (window as any).BarcodeDetector.getSupportedFormats().then((formats: string[]) => {\n                console.log(`[Scanner] Browser natively supports: ${formats.join(', ')}`);\n            }).catch(console.error);\n        }\n\n        return () => {\n            mounted = false;\n        };\n    }, [visible, permission, scannerMode]);\n\n    // html5-qrcode lifecycle (web-camera mode)\n    useEffect(() => {\n        if (Platform.OS !== 'web' || scannerMode !== 'web-camera' || !visible) return;\n\n        let isCancelled = false;\n\n        const startWebScanner = async () => {\n            try {\n                // Dynamic import — only loaded on web, no native bundle impact\n                // @ts-expect-error -- dynamic import fine for web build\n                const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');\n\n                if (isCancelled) return;\n\n                const scannerId = 'web-scanner-reader';\n\n                // Ensure the DOM element exists before init\n                const container = document.getElementById(scannerId);\n                if (!container) {\n                    // Not mounted yet — retry briefly\n                    setTimeout(() => { if (!isCancelled) startWebScanner(); }, 200);\n                    return;\n                }\n\n                const html5Qrcode = new Html5Qrcode(scannerId);\n                html5QrcodeRef.current = html5Qrcode;\n\n                await html5Qrcode.start(\n                    { facingMode: 'environment' },\n                    {\n                        fps: 10,\n                        qrbox: { width: 250, height: 250 },\n                        formatsToSupport: [\n                            Html5QrcodeSupportedFormats.QR_CODE,\n                            Html5QrcodeSupportedFormats.CODE_128,\n                            Html5QrcodeSupportedFormats.CODE_39,\n                            Html5QrcodeSupportedFormats.EAN_13,\n                            Html5QrcodeSupportedFormats.EAN_8,\n                            Html5QrcodeSupportedFormats.UPC_A,\n                            Html5QrcodeSupportedFormats.UPC_E,\n                            Html5QrcodeSupportedFormats.DATA_MATRIX,\n                            Html5QrcodeSupportedFormats.PDF_417,\n                        ],\n                    },\n                    async (decodedText: string) => {\n                        if (webScanInProgress.current) return;\n                        webScanInProgress.current = true;\n                        try {\n                            const matched = await onScan(decodedText);\n                            if (matched) {\n                                playSuccess();\n                                showScanMatch('match');\n                            } else {\n                                playError();\n                                showScanMatch('no-match');\n                            }\n                        } catch {\n                            playError();\n                            showScanMatch('no-match');\n                        }\n                        // Short cooldown before allowing next scan\n                        setTimeout(() => {\n                            webScanInProgress.current = false;\n                        }, 1500);\n                    },\n                    () => {\n                        // Scan failure callback — ignore (fires on every frame with no barcode)\n                    }\n                );\n            } catch (err: any) {\n                console.error('[WebScanner] Failed to start html5-qrcode:', err);\n                setWebCameraError(err?.message || 'Gagal mengakses kamera. Periksa izin browser atau coba browser lain.');\n            }\n        };\n\n        startWebScanner();\n\n        return () => {\n            isCancelled = true;\n            if (html5QrcodeRef.current) {\n                html5QrcodeRef.current\n                    .stop()\n                    .then(() => {\n                        html5QrcodeRef.current?.clear();\n                        html5QrcodeRef.current = null;\n                    })\n                    .catch(() => {\n                        html5QrcodeRef.current = null;\n                    });\n            }\n        };\n    }, [visible, scannerMode, onScan, playSuccess, playError, showScanMatch]);\n\n    const toggleScannerMode = async () => {\n        let newMode: 'camera' | 'hardware' | 'web-camera';\n        if (Platform.OS === 'web') {\n            // Web: cycle 'hardware' ↔ 'web-camera'\n            newMode = scannerMode === 'hardware' ? 'web-camera' : 'hardware';\n        } else {\n            // Native: cycle 'camera' ↔ 'hardware'\n            newMode = scannerMode === 'camera' ? 'hardware' : 'camera';\n        }\n        setScannerMode(newMode);\n        await AsyncStorage.setItem('@scanner_mode', newMode);\n        if (newMode === 'hardware') {\n            setTimeout(() => hwInputRef.current?.focus(), 200);\n        }\n    };\n\n    const handleBarCodeScanned = async (result: { type: string, data: string }) => {\n        if (scanned) return;\n        setScanned(true);\n        try {\n            const matched = await onScan(result.data);\n            if (matched) {\n                playSuccess();\n                showScanMatch('match');\n            } else {\n                playError();\n                showScanMatch('no-match');\n            }\n        } catch {\n            playError();\n            showScanMatch('no-match');\n        }\n        // In continuous mode, use shorter cooldown (1s) so user can scan rapidly\n        // In single-scan mode, use 2s cooldown\n        const cooldown = continuous ? 1000 : 2000;\n        setTimeout(() => {\n            setScanned(false);\n        }, cooldown);\n    };\n\n    // Stable settings object to prevent unnecessary re-renders/scanner resets\n    // Some browsers on Web require explicit types to activate the 1D detection engine\n    const scannerSettings = useMemo(() => ({\n        barcodeTypes: [\n            \"qr\",\n            \"ean13\",\n            \"ean8\",\n            \"code128\",\n            \"code39\",\n            \"upc_a\",\n            \"upc_e\",\n            \"datamatrix\",\n            \"pdf417\"\n        ] as any[],\n    }), []);\n\n    if (!visible) return null;\n\n    return (\n        <View style={[StyleSheet.absoluteFill, { zIndex: 10000, backgroundColor: 'black' }]}>\n            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>\n                <StatusBar barStyle=\"light-content\" />\n\n                {!permission?.granted && scannerMode !== 'web-camera' ? (\n                    <View style={styles.permissionContainer}>\n                        <Typography variant=\"h3\" weight=\"bold\" className=\"text-center mb-4\">Izin Kamera Diperlukan</Typography>\n                        <Typography className=\"text-gray-500 text-center mb-8 px-10\">\n                            Kami memerlukan akses kamera untuk memindai barcode sparepart secara instan.\n                        </Typography>\n                        <Button title=\"Berikan Izin\" onPress={requestPermission} />\n                        <Pressable onPress={onClose} className=\"mt-4\">\n                            <Typography className=\"text-gray-400\">Batal</Typography>\n                        </Pressable>\n                    </View>\n                ) : (\n                    <View style={styles.cameraContainer}>\n                        {webCameraError ? (\n                            <View className=\"flex-1 items-center justify-center bg-gray-900 px-10\">\n                                <View className=\"w-20 h-20 bg-red-500/10 rounded-full items-center justify-center mb-6 border border-red-500/20\">\n                                    <AlertTriangle size={40} color=\"#EF4444\" strokeWidth={1} />\n                                </View>\n                                <Typography variant=\"h3\" weight=\"bold\" className=\"text-white text-center mb-3\">Kamera Tidak Tersedia</Typography>\n                                <Typography className=\"text-gray-400 text-center mb-8\">{webCameraError}</Typography>\n                                <View className=\"flex-row space-x-3\">\n                                    <Button title=\"Coba Lagi\" variant=\"primary\" onPress={() => { setWebCameraError(null); setWebFlashVisible(false); }} />\n                                    <Button title=\"Tutup\" variant=\"secondary\" onPress={onClose} />\n                                </View>\n                            </View>\n                        ) : scannerMode === 'web-camera' ? (\n                            <View className=\"flex-1 items-center justify-center bg-gray-900 px-4\">\n                                {/* Web Camera Scanner via html5-qrcode */}\n                                <View className=\"w-full max-w-md\">\n                                    <View className=\"items-center mb-4\">\n                                        <View className=\"w-16 h-16 bg-blue-500/10 rounded-full items-center justify-center mb-4 border border-blue-500/20\">\n                                            <Camera size={32} color=\"#3B82F6\" strokeWidth={1} />\n                                        </View>\n                                        <Typography variant=\"h3\" weight=\"bold\" className=\"text-white text-center mb-2\">Web Camera</Typography>\n                                        <Typography className=\"text-gray-400 text-center text-sm\">\n                                            Arahkan kamera ke barcode/QR code untuk memindai.\n                                        </Typography>\n                                    </View>\n                                    <View\n                                        // @ts-ignore — id is valid on web for html5-qrcode to attach\n                                        id=\"web-scanner-reader\"\n                                        ref={webScannerContainerRef}\n                                        style={{\n                                            width: '100%',\n                                            height: 350,\n                                            borderRadius: 16,\n                                            overflow: 'hidden',\n                                            backgroundColor: '#000',\n                                            borderWidth: 2,\n                                            borderColor: scanMatch === 'no-match' ? '#EF4444' : scanMatch === 'match' ? '#10B981' : 'rgba(59,130,246,0.3)',\n                                            borderStyle: 'solid',\n                                        }}\n                                    />\n                                    {/* A11y: scan result announcements */}\n                                    <View\n                                        aria-live=\"assertive\"\n                                        aria-atomic=\"true\"\n                                        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}\n                                    >\n                                        {scanMatch === 'match' ? 'Item ditemukan' : scanMatch === 'no-match' ? 'Item tidak ditemukan' : ''}\n                                    </View>\n                                </View>\n                            </View>\n                        ) : scannerMode === 'camera' ? (\n                            <CameraView\n                                style={styles.camera}\n                                enableTorch={torch}\n                                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}\n                                barcodeScannerSettings={scannerSettings}\n                            >\n                                {/* Overlay */}\n                                <View style={styles.overlay}>\n                                    <View style={styles.unfocusedContainer}>\n                                        {/* Item Scan Mode Badge */}\n                                        {continuous && (\n                                            <View style={{ position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.85)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>\n                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6EE7B7', marginRight: 8 }} />\n                                                <Typography weight=\"bold\" style={{ color: 'white', fontSize: 11 }}>ITEM SCAN</Typography>\n                                                {scanLog.length > 0 && (\n                                                    <View style={{ backgroundColor: 'white', borderRadius: 10, marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2 }}>\n                                                        <Typography weight=\"bold\" style={{ color: '#059669', fontSize: 11 }}>{scanLog.length}</Typography>\n                                                    </View>\n                                                )}\n                                            </View>\n                                        )}\n                                    </View>\n                                    <View style={styles.middleContainer}>\n                                        <View style={styles.unfocusedContainer}></View>\n                                        <View style={styles.focusedContainer}>\n                                            <View style={[styles.corner, styles.topLeft]} />\n                                            <View style={[styles.corner, styles.topRight]} />\n                                            <View style={[styles.corner, styles.bottomLeft]} />\n                                            <View style={[styles.corner, styles.bottomRight]} />\n\n                                            {/* Laser Line */}\n                                            <View style={[styles.laser, { top: laserPos }]} />\n\n                                            {/* Scan match indicator: green for match, red for no-match */}\n                                            {scanMatch === 'match' && (\n                                                <View style={styles.scannedMatchIndicator}>\n                                                    <CheckCircle2 size={28} color=\"white\" strokeWidth={2} />\n                                                    <Typography weight=\"bold\" style={{ color: 'white', marginTop: 4 }}>\n                                                        {continuous ? 'Item Ditemukan!' : 'Terdeteksi!'}\n                                                    </Typography>\n                                                </View>\n                                            )}\n                                            {scanMatch === 'no-match' && (\n                                                <View style={styles.scannedNoMatchIndicator}>\n                                                    <View style={styles.noMatchIconContainer}>\n                                                        <Typography weight=\"bold\" style={{ color: 'white', fontSize: 20 }}>✕</Typography>\n                                                    </View>\n                                                    <Typography weight=\"bold\" style={{ color: 'white', marginTop: 4 }}>Item Tidak Ditemukan</Typography>\n                                                </View>\n                                            )}\n                                        </View>\n                                        <View style={styles.unfocusedContainer}></View>\n                                    </View>\n                                    <View style={styles.unfocusedContainer}>\n                                        <View className=\"items-center mt-6\">\n                                            <Typography className=\"text-white text-center mb-6\" style={{ opacity: 0.7 }}>\n                                                {continuous\n                                                    ? 'Scan terus-menerus — arahkan ke barcode berikutnya'\n                                                    : 'Posisikan barcode/QR code di dalam kotak'\n                                                }\n                                            </Typography>\n\n                                            {/* Scanner Log Overlay */}\n                                            {scanLog.length > 0 && (\n                                                <View className=\"w-[90%] bg-black/40 rounded-3xl p-4 border border-white/10 mt-2\">\n                                                    <Typography variant=\"caption\" weight=\"bold\" className=\"text-white/60 mb-3 ml-1 uppercase\" style={{ letterSpacing: 1 }}>History Scan Terakhir</Typography>\n                                                    {scanLog.slice(0, 3).map((item, idx) => (\n                                                        <View key={item.id} className={`flex-row items-center py-2.5 px-3 mb-2 rounded-2xl ${idx === 0 ? 'bg-blue-600/30 border border-blue-500/30' : 'bg-white/5 border border-white/5'}`}>\n                                                            <View className={`w-2 h-2 rounded-full mr-3 ${idx === 0 ? 'bg-blue-400' : 'bg-white/20'}`} />\n                                                            <View className=\"flex-1\">\n                                                                <Typography weight=\"bold\" className=\"text-white text-sm\" numberOfLines={1}>{item.title}</Typography>\n                                                                {item.subtitle && <Typography variant=\"caption\" className=\"text-white/50 text-[10px]\">{item.subtitle}</Typography>}\n                                                            </View>\n                                                            <Typography variant=\"caption\" className=\"text-white/40 ml-2\">Baru saja</Typography>\n                                                        </View>\n                                                    ))}\n                                                    <Typography variant=\"caption\" weight=\"bold\" className=\"text-blue-400 text-center mt-2 mb-4\">Total: {scanLog.length} item tersimpan</Typography>\n\n                                                    <Button\n                                                        title=\"Selesai & Tutup\"\n                                                        variant=\"primary\"\n                                                        onPress={onClose}\n                                                        className=\"h-12 rounded-2xl\"\n                                                    />\n                                                </View>\n                                            )}\n                                        </View>\n                                    </View>\n                                </View>\n                                {/* A11y: scan result announcements for native camera */}\n                                <View\n                                    aria-live=\"assertive\"\n                                    aria-atomic=\"true\"\n                                    style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}\n                                >\n                                    {scanMatch === 'match' ? 'Item ditemukan' : scanMatch === 'no-match' ? 'Item tidak ditemukan' : ''}\n                                </View>\n                            </CameraView>\n                        ) : (\n                            <View className=\"flex-1 items-center justify-center bg-gray-900 px-10\">\n                                {/* Item Scan Mode Badge for Hardware */}\n                                {continuous && (\n                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.85)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 24 }}>\n                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6EE7B7', marginRight: 8 }} />\n                                        <Typography weight=\"bold\" style={{ color: 'white', fontSize: 11 }}>ITEM SCAN</Typography>\n                                        {scanLog.length > 0 && (\n                                            <View style={{ backgroundColor: 'white', borderRadius: 10, marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2 }}>\n                                                <Typography weight=\"bold\" style={{ color: '#059669', fontSize: 11 }}>{scanLog.length}</Typography>\n                                            </View>\n                                        )}\n                                    </View>\n                                )}\n                                <View className=\"w-40 h-40 bg-blue-500/10 rounded-full items-center justify-center mb-8 border border-blue-500/20\">\n                                    <Scan size={64} color=\"#3B82F6\" strokeWidth={1} />\n                                </View>\n                                <Typography variant=\"h3\" weight=\"bold\" className=\"text-white text-center mb-2\">Hardware Mode</Typography>\n                                <Typography className=\"text-gray-400 text-center mb-10\">\n                                    {continuous\n                                        ? 'Scan terus-menerus — arahkan ke barcode berikutnya'\n                                        : 'Arahkan hardware scanner ke barcode dan tekan pelatuk scan.'\n                                    }\n                                </Typography>\n\n                                <Pressable\n                                    onPress={() => hwInputRef.current?.focus()}\n                                    className=\"bg-white/5 border border-white/10 px-6 py-4 rounded-3xl items-center w-full\"\n                                >\n                                    <Typography className=\"text-blue-400 font-bold\">Siap Menerima Scan...</Typography>\n                                </Pressable>\n\n                                {scanLog.length > 0 && (\n                                    <View className=\"mt-8 w-full\">\n                                        <Typography variant=\"caption\" weight=\"bold\" className=\"text-white/40 text-center uppercase mb-4 tracking-widest\">Item Terakhir</Typography>\n                                        <View className=\"bg-white/5 border border-white/10 p-4 rounded-3xl mb-4\">\n                                            <Typography weight=\"bold\" className=\"text-white text-center\">{scanLog[0].title}</Typography>\n                                            <Typography variant=\"caption\" className=\"text-white/50 text-center\">{scanLog[0].subtitle}</Typography>\n                                        </View>\n                                        {continuous && (\n                                            <View>\n                                                <Typography variant=\"caption\" weight=\"bold\" className=\"text-emerald-400 text-center mb-4\">Total: {scanLog.length} item tersimpan</Typography>\n                                                <Button\n                                                    title=\"Selesai & Tutup\"\n                                                    variant=\"primary\"\n                                                    onPress={onClose}\n                                                    className=\"h-12 rounded-2xl\"\n                                                />\n                                            </View>\n                                        )}\n                                    </View>\n                                )}\n                                {/* A11y for hardware mode */}\n                                <View\n                                    aria-live=\"assertive\"\n                                    aria-atomic=\"true\"\n                                    style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}\n                                >\n                                    {scanMatch === 'match' ? 'Item ditemukan' : scanMatch === 'no-match' ? 'Item tidak ditemukan' : ''}\n                                </View>\n                            </View>\n                        )}\n\n                        {/* Hidden Input for Hardware Scanner */}\n                        <TextInput\n                            ref={hwInputRef}\n                            style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}\n                            value={hwInput}\n                            onChangeText={setHwInput}\n                            onSubmitEditing={(e) => {\n                                const code = e.nativeEvent.text;\n                                if (code) {\n                                    handleBarCodeScanned({ type: 'hardware', data: code });\n                                    setHwInput('');\n                                    // Keep focused for next scan\n                                    setTimeout(() => hwInputRef.current?.focus(), 100);\n                                }\n                            }}\n                            autoFocus={visible}\n                            blurOnSubmit={false}\n                        />\n\n                        {/* Controls */}\n                        <View style={styles.header}>\n                            <Pressable\n                                onPress={toggleScannerMode}\n                                style={[styles.iconButton, { width: 'auto', paddingHorizontal: 16 }]}\n                            >\n                                {scannerMode === 'camera' ? (\n                                    <View className=\"flex-row items-center\">\n                                        <Scan size={18} color=\"white\" />\n                                        <Typography className=\"text-white text-[10px] ml-2 font-bold uppercase\">To Hardware</Typography>\n                                    </View>\n                                ) : scannerMode === 'web-camera' ? (\n                                    <View className=\"flex-row items-center\">\n                                        <Scan size={18} color=\"white\" />\n                                        <Typography className=\"text-white text-[10px] ml-2 font-bold uppercase\">To Hardware</Typography>\n                                    </View>\n                                ) : (\n                                    <View className=\"flex-row items-center\">\n                                        <Camera size={18} color=\"white\" />\n                                        <Typography className=\"text-white text-[10px] ml-2 font-bold uppercase\">To Camera</Typography>\n                                    </View>\n                                )}\n                            </Pressable>\n                            <View className=\"flex-row space-x-2\">\n                                {scannerMode === 'camera' && (\n                                    <Pressable onPress={() => setTorch(!torch)} style={styles.iconButton}>\n                                        {torch ? <Zap size={24} color=\"#FBBF24\" /> : <ZapOff size={24} color=\"white\" />}\n                                    </Pressable>\n                                )}\n                                <Pressable onPress={onClose} style={styles.iconButton}>\n                                    <X size={24} color=\"white\" />\n                                </Pressable>\n                            </View>\n                        </View>\n                    </View>\n                )}\n            </View>\n        </View>\n    );\n};\n\nconst styles = StyleSheet.create({\n    container: {\n        flex: 1,\n        backgroundColor: 'black',\n    },\n    permissionContainer: {\n        flex: 1,\n        justifyContent: 'center',\n        alignItems: 'center',\n        padding: 24,\n        backgroundColor: 'white',\n    },\n    cameraContainer: {\n        flex: 1,\n        position: 'relative',\n    },\n    camera: {\n        flex: 1,\n    },\n    header: {\n        position: 'absolute',\n        top: Platform.OS === 'ios' ? 20 : 40,\n        left: 20,\n        right: 20,\n        flexDirection: 'row',\n        justifyContent: 'space-between',\n        zIndex: 10,\n    },\n    iconButton: {\n        width: 44,\n        height: 44,\n        backgroundColor: 'rgba(0,0,0,0.5)',\n        borderRadius: 22,\n        alignItems: 'center',\n        justifyContent: 'center',\n    },\n    overlay: {\n        flex: 1,\n    },\n    unfocusedContainer: {\n        flex: 1,\n        backgroundColor: 'rgba(0,0,0,0.6)',\n    },\n    middleContainer: {\n        flexDirection: 'row',\n        height: 250,\n    },\n    focusedContainer: {\n        width: 250,\n        position: 'relative',\n    },\n    corner: {\n        position: 'absolute',\n        width: 30,\n        height: 30,\n        borderColor: '#3B82F6',\n        borderWidth: 4,\n    },\n    topLeft: {\n        top: 0,\n        left: 0,\n        borderRightWidth: 0,\n        borderBottomWidth: 0,\n        borderTopLeftRadius: 16,\n    },\n    topRight: {\n        top: 0,\n        right: 0,\n        borderLeftWidth: 0,\n        borderBottomWidth: 0,\n        borderTopRightRadius: 16,\n    },\n    bottomLeft: {\n        bottom: 0,\n        left: 0,\n        borderRightWidth: 0,\n        borderTopWidth: 0,\n        borderBottomLeftRadius: 16,\n    },\n    bottomRight: {\n        bottom: 0,\n        right: 0,\n        borderLeftWidth: 0,\n        borderTopWidth: 0,\n        borderBottomRightRadius: 16,\n    },\n    scannedMatchIndicator: {\n        ...StyleSheet.absoluteFillObject,\n        backgroundColor: 'rgba(16, 185, 129, 0.55)',\n        alignItems: 'center',\n        justifyContent: 'center',\n        borderRadius: 16,\n    },\n    scannedNoMatchIndicator: {\n        ...StyleSheet.absoluteFillObject,\n        backgroundColor: 'rgba(239, 68, 68, 0.55)',\n        alignItems: 'center',\n        justifyContent: 'center',\n        borderRadius: 16,\n    },\n    noMatchIconContainer: {\n        width: 36,\n        height: 36,\n        borderRadius: 18,\n        backgroundColor: 'rgba(255,255,255,0.2)',\n        alignItems: 'center',\n        justifyContent: 'center',\n    },\n    laser: {\n        position: 'absolute',\n        left: 10,\n        right: 10,\n        height: 2,\n        backgroundColor: '#3B82F6',\n        shadowColor: \"#3B82F6\",\n        shadowOffset: { width: 0, height: 0 },\n        shadowOpacity: 0.8,\n        shadowRadius: 10,\n        elevation: 10,\n    }\n});\n"
}
GateGuard blocked the Write. Facts as requested:

1. **Callers** (8 files, 10 call sites, confirmed via Grep):
   - `frontend/components/BengkelForm.tsx:12,1744,1788`
   - `frontend/app/bengkel/transaksi/index.tsx:10,1335`
   - `frontend/components/ui/SparePartSelector.tsx:7,191`
   - `frontend/components/forms/SparepartForm.tsx:7,227`
   - `frontend/app/bengkel/inventory.tsx:47,895`
   - `frontend/app/bengkel/purchase/create.tsx:25,1037`
   - `frontend/app/bengkel/index.tsx:46,2224`

2. **No duplicate** — overwriting existing file `frontend/components/ui/BarcodeScannerModal.tsx` (601 lines)

3. **No data files** — pure UI component, no file I/O

4. **User instruction**: Feature task `feature-1782031296256-c6b4r5i3yl` — Improve BarcodeScannerModal with: red no-match indicator, louder volume, "ITEM SCAN" rename, Code 128 fix, a11y, error handling

Retrying Write:

🔧 Tool: Write
Input: {
  "file_path": "C:\\laragon\\www\\tpm\\frontend\\components\\ui\\BarcodeScannerModal.tsx",
  "content": "import React, { useState, useEffect, useRef, useMemo, useCallback, FC } from 'react';\nimport { View, StyleSheet, Pressable, SafeAreaView, StatusBar, Platform, TextInput, Animated } from 'react-native';\nimport AsyncStorage from '@react-native-async-storage/async-storage';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';\nimport { CameraView, useCameraPermissions } from 'expo-camera';\nimport { Typography } from './Typography';\nimport { X, Zap, ZapOff, Scan, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react-native';\nimport { Button } from './Button';\nimport { useScanSound, ensureAudioUnlocked } from '../../utils/sounds';\n\n// Dynamic import type for html5-qrcode (web only)\ntype Html5QrcodeType = any;\n\ntype ScanMatch = 'none' | 'match' | 'no-match';\n\ninterface BarcodeScannerModalProps {\n    visible: boolean;\n    onClose: () => void;\n    onScan: (data: string) => boolean | Promise<boolean>;\n    scanLog?: { id: string; title: string; subtitle?: string; timestamp: number }[];\n    continuous?: boolean;\n}\n\nexport const BarcodeScannerModal: FC<BarcodeScannerModalProps> = ({\n    visible,\n    onClose,\n    onScan,\n    scanLog = [],\n    continuous = false\n}) => {\n    const insets = useSafeAreaInsets();\n    const [permission, requestPermission] = useCameraPermissions();\n    const [scanned, setScanned] = useState(false);\n    const [torch, setTorch] = useState(false);\n    const [laserPos, setLaserPos] = useState(0);\n    const [movingDown, setMovingDown] = useState(true);\n    const [scannerMode, setScannerMode] = useState<'camera' | 'hardware' | 'web-camera'>('camera');\n    const [hwInput, setHwInput] = useState('');\n    const hwInputRef = useRef<TextInput>(null);\n\n    // html5-qrcode refs (web camera scanner)\n    const html5QrcodeRef = useRef<Html5QrcodeType>(null);\n    const webScannerContainerRef = useRef<View | null>(null);\n    const webScanInProgress = useRef(false);\n    const scannerPausedRef = useRef(false);\n\n    // Scan sound hook\n    const { playSuccess, playError } = useScanSound();\n\n    // Web camera error + flash indicator state\n    const [webCameraError, setWebCameraError] = useState<string | null>(null);\n    const [webFlashVisible, setWebFlashVisible] = useState(false);\n    const flashAnim = useRef(new Animated.Value(0)).current;\n\n    // Scan match indicator state\n    const [scanMatch, setScanMatch] = useState<ScanMatch>('none');\n    const scanMatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);\n\n    const triggerWebFlash = useCallback(() => {\n        setWebFlashVisible(true);\n        flashAnim.setValue(0);\n        Animated.timing(flashAnim, {\n            toValue: 1,\n            duration: 300,\n            useNativeDriver: true,\n        }).start(() => {\n            setWebFlashVisible(false);\n        });\n    }, [flashAnim]);\n\n    const showScanMatch = useCallback((match: ScanMatch) => {\n        if (scanMatchTimer.current) clearTimeout(scanMatchTimer.current);\n        setScanMatch(match);\n        scanMatchTimer.current = setTimeout(() => {\n            setScanMatch('none');\n        }, 1500);\n    }, []);\n\n    // Laser Animation Effect\n    useEffect(() => {\n        if (!visible) return;\n        const interval = setInterval(() => {\n            setLaserPos((prev: number) => {\n                if (movingDown) {\n                    if (prev >= 240) { setMovingDown(false); return 240; }\n                    return prev + 5;\n                } else {\n                    if (prev <= 10) { setMovingDown(true); return 10; }\n                    return prev - 5;\n                }\n            });\n        }, 30);\n        return () => clearInterval(interval);\n    }, [visible, movingDown]);\n\n    useEffect(() => {\n        let mounted = true;\n\n        const initializeScanner = async () => {\n            if (!mounted) return;\n\n            if (visible && !permission?.granted && scannerMode === 'camera') {\n                requestPermission();\n            }\n\n            // Load preferred mode\n            const saved = await AsyncStorage.getItem('@scanner_mode');\n            if (mounted && saved) setScannerMode(saved as any);\n        };\n\n        initializeScanner();\n\n        // Auto-focus hardware input if visible\n        if (visible) {\n            const timeoutId = setTimeout(() => hwInputRef.current?.focus(), 500);\n            return () => clearTimeout(timeoutId);\n        }\n\n        // Browser compatibility check for 1D barcodes\n        if (visible && Platform.OS === 'web' && (window as any).BarcodeDetector) {\n            (window as any).BarcodeDetector.getSupportedFormats().then((formats: string[]) => {\n                console.log(`[Scanner] Browser natively supports: ${formats.join(', ')}`);\n            }).catch(console.error);\n        }\n\n        return () => {\n            mounted = false;\n        };\n    }, [visible, permission, scannerMode]);\n\n    // html5-qrcode lifecycle (web-camera mode) — Code 128 fix\n    useEffect(() => {\n        if (Platform.OS !== 'web' || scannerMode !== 'web-camera' || !visible) return;\n\n        let isCancelled = false;\n\n        const startWebScanner = async () => {\n            try {\n                // Dynamic import — only loaded on web, no native bundle impact\n                // @ts-expect-error -- dynamic import fine for web build\n                const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');\n\n                if (isCancelled) return;\n\n                const scannerId = 'web-scanner-reader';\n\n                // Ensure the DOM element exists before init\n                const container = document.getElementById(scannerId);\n                if (!container) {\n                    // Not mounted yet — retry briefly\n                    setTimeout(() => { if (!isCancelled) startWebScanner(); }, 200);\n                    return;\n                }\n\n                const html5Qrcode = new Html5Qrcode(scannerId);\n                html5QrcodeRef.current = html5Qrcode;\n\n                await html5Qrcode.start(\n                    { facingMode: 'environment' },\n                    {\n                        fps: 10,\n                        qrbox: { width: 250, height: 250 },\n                        formatsToSupport: [\n                            Html5QrcodeSupportedFormats.QR_CODE,\n                            Html5QrcodeSupportedFormats.CODE_128,\n                            Html5QrcodeSupportedFormats.CODE_39,\n                            Html5QrcodeSupportedFormats.EAN_13,\n                            Html5QrcodeSupportedFormats.EAN_8,\n                            Html5QrcodeSupportedFormats.UPC_A,\n                            Html5QrcodeSupportedFormats.UPC_E,\n                            Html5QrcodeSupportedFormats.DATA_MATRIX,\n                            Html5QrcodeSupportedFormats.PDF_417,\n                        ],\n                    },\n                    async (decodedText: string) => {\n                        if (webScanInProgress.current) return;\n                        webScanInProgress.current = true;\n                        try {\n                            const matched = await onScan(decodedText);\n                            if (matched) {\n                                playSuccess();\n                                showScanMatch('match');\n                            } else {\n                                playError();\n                                showScanMatch('no-match');\n                            }\n                        } catch {\n                            playError();\n                            showScanMatch('no-match');\n                        }\n                        // Short cooldown before allowing next scan\n                        setTimeout(() => {\n                            webScanInProgress.current = false;\n                        }, 1500);\n                    },\n                    () => {\n                        // Scan failure callback — ignore (fires on every frame with no barcode)\n                    }\n                );\n            } catch (err: any) {\n                console.error('[WebScanner] Failed to start html5-qrcode:', err);\n                setWebCameraError(err?.message || 'Gagal mengakses kamera. Periksa izin browser atau coba browser lain.');\n            }\n        };\n\n        startWebScanner();\n\n        return () => {\n            isCancelled = true;\n            if (html5QrcodeRef.current) {\n                html5QrcodeRef.current\n                    .stop()\n                    .then(() => {\n                        html5QrcodeRef.current?.clear();\n                        html5QrcodeRef.current = null;\n                    })\n                    .catch(() => {\n                        html5QrcodeRef.current = null;\n                    });\n            }\n        };\n    }, [visible, scannerMode, onScan, playSuccess, playError, showScanMatch]);\n\n    const toggleScannerMode = async () => {\n        let newMode: 'camera' | 'hardware' | 'web-camera';\n        if (Platform.OS === 'web') {\n            // Web: cycle 'hardware' ↔ 'web-camera'\n            newMode = scannerMode === 'hardware' ? 'web-camera' : 'hardware';\n        } else {\n            // Native: cycle 'camera' ↔ 'hardware'\n            newMode = scannerMode === 'camera' ? 'hardware' : 'camera';\n        }\n        setScannerMode(newMode);\n        await AsyncStorage.setItem('@scanner_mode', newMode);\n        if (newMode === 'hardware') {\n            setTimeout(() => hwInputRef.current?.focus(), 200);\n        }\n    };\n\n    const handleBarCodeScanned = async (result: { type: string, data: string }) => {\n        if (scanned) return;\n        setScanned(true);\n        try {\n            const matched = await onScan(result.data);\n            if (matched) {\n                playSuccess();\n                showScanMatch('match');\n            } else {\n                playError();\n                showScanMatch('no-match');\n            }\n        } catch {\n            playError();\n            showScanMatch('no-match');\n        }\n        // In continuous mode, use shorter cooldown (1s) so user can scan rapidly\n        // In single-scan mode, use 2s cooldown\n        const cooldown = continuous ? 1000 : 2000;\n        setTimeout(() => {\n            setScanned(false);\n        }, cooldown);\n    };\n\n    // Stable settings object to prevent unnecessary re-renders/scanner resets\n    const scannerSettings = useMemo(() => ({\n        barcodeTypes: [\n            \"qr\",\n            \"ean13\",\n            \"ean8\",\n            \"code128\",\n            \"code39\",\n            \"upc_a\",\n            \"upc_e\",\n            \"datamatrix\",\n            \"pdf417\"\n        ] as any[],\n    }), []);\n\n    if (!visible) return null;\n\n    return (\n        <View style={[StyleSheet.absoluteFill, { zIndex: 10000, backgroundColor: 'black' }]}>\n            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>\n                <StatusBar barStyle=\"light-content\" />\n\n                {!permission?.granted && scannerMode !== 'web-camera' ? (\n                    <View style={styles.permissionContainer}>\n                        <Typography variant=\"h3\" weight=\"bold\" className=\"text-center mb-4\">Izin Kamera Diperlukan</Typography>\n                        <Typography className=\"text-gray-500 text-center mb-8 px-10\">\n                            Kami memerlukan akses kamera untuk memindai barcode sparepart secara instan.\n                        </Typography>\n                        <Button title=\"Berikan Izin\" onPress={requestPermission} />\n                        <Pressable onPress={onClose} className=\"mt-4\">\n                            <Typography className=\"text-gray-400\">Batal</Typography>\n                        </Pressable>\n                    </View>\n                ) : (\n                    <View style={styles.cameraContainer}>\n                        {webCameraError ? (\n                            <View className=\"flex-1 items-center justify-center bg-gray-900 px-10\">\n                                <View className=\"w-20 h-20 bg-red-500/10 rounded-full items-center justify-center mb-6 border border-red-500/20\">\n                                    <AlertTriangle size={40} color=\"#EF4444\" strokeWidth={1} />\n                                </View>\n                                <Typography variant=\"h3\" weight=\"bold\" className=\"text-white text-center mb-3\">Kamera Tidak Tersedia</Typography>\n                                <Typography className=\"text-gray-400 text-center mb-8\">{webCameraError}</Typography>\n                                <View className=\"flex-row space-x-3\">\n                                    <Button title=\"Coba Lagi\" variant=\"primary\" onPress={() => { setWebCameraError(null); }} />\n                                    <Button title=\"Tutup\" variant=\"secondary\" onPress={onClose} />\n                                </View>\n                            </View>\n                        ) : scannerMode === 'web-camera' ? (\n                            <View className=\"flex-1 items-center justify-center bg-gray-900 px-4\">\n                                {/* Web Camera Scanner via html5-qrcode */}\n                                <View className=\"w-full max-w-md\">\n                                    <View className=\"items-center mb-4\">\n                                        <View className=\"w-16 h-16 bg-blue-500/10 rounded-full items-center justify-center mb-4 border border-blue-500/20\">\n                                            <Camera size={32} color=\"#3B82F6\" strokeWidth={1} />\n                                        </View>\n                                        <Typography variant=\"h3\" weight=\"bold\" className=\"text-white text-center mb-2\">Web Camera</Typography>\n                                        <Typography className=\"text-gray-400 text-center text-sm\">\n                                            Arahkan kamera ke barcode/QR code untuk memindai.\n                                        </Typography>\n                                    </View>\n                                    <View\n                                        // @ts-ignore — id is valid on web for html5-qrcode to attach\n                                        id=\"web-scanner-reader\"\n                                        ref={webScannerContainerRef}\n                                        style={{\n                                            width: '100%',\n                                            height: 350,\n                                            borderRadius: 16,\n                                            overflow: 'hidden',\n                                            backgroundColor: '#000',\n                                            borderWidth: 2,\n                                            borderColor: scanMatch === 'no-match' ? '#EF4444' : scanMatch === 'match' ? '#10B981' : 'rgba(59,130,246,0.3)',\n                                            borderStyle: 'solid',\n                                        }}\n                                    />\n                                    {/* A11y: screen reader announces scan results */}\n                                    <View\n                                        aria-live=\"assertive\"\n                                        aria-atomic=\"true\"\n                                        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}\n                                    >\n                                        {scanMatch === 'match' ? 'Item ditemukan' : scanMatch === 'no-match' ? 'Item tidak ditemukan' : ''}\n                                    </View>\n                                </View>\n                            </View>\n                        ) : scannerMode === 'camera' ? (\n                            <CameraView\n                                style={styles.camera}\n                                enableTorch={torch}\n                                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}\n                                barcodeScannerSettings={scannerSettings}\n                            >\n                                {/* Overlay */}\n                                <View style={styles.overlay}>\n                                    <View style={styles.unfocusedContainer}>\n                                        {/* Item Scan Mode Badge */}\n                                        {continuous && (\n                                            <View style={{ position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.85)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>\n                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6EE7B7', marginRight: 8 }} />\n                                                <Typography weight=\"bold\" style={{ color: 'white', fontSize: 11 }}>ITEM SCAN</Typography>\n                                                {scanLog.length > 0 && (\n                                                    <View style={{ backgroundColor: 'white', borderRadius: 10, marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2 }}>\n                                                        <Typography weight=\"bold\" style={{ color: '#059669', fontSize: 11 }}>{scanLog.length}</Typography>\n                                                    </View>\n                                                )}\n                                            </View>\n                                        )}\n                                    </View>\n                                    <View style={styles.middleContainer}>\n                                        <View style={styles.unfocusedContainer}></View>\n                                        <View style={styles.focusedContainer}>\n                                            <View style={[styles.corner, styles.topLeft]} />\n                                            <View style={[styles.corner, styles.topRight]} />\n                                            <View style={[styles.corner, styles.bottomLeft]} />\n                                            <View style={[styles.corner, styles.bottomRight]} />\n\n                                            {/* Laser Line */}\n                                            <View style={[styles.laser, { top: laserPos }]} />\n\n                                            {/* Scan match indicator: green for match, red for no-match */}\n                                            {scanMatch === 'match' && (\n                                                <View style={styles.scannedMatchIndicator}>\n                                                    <CheckCircle2 size={28} color=\"white\" strokeWidth={2} />\n                                                    <Typography weight=\"bold\" style={{ color: 'white', marginTop: 4 }}>\n                                                        {continuous ? 'Item Ditemukan!' : 'Terdeteksi!'}\n                                                    </Typography>\n                                                </View>\n                                            )}\n                                            {scanMatch === 'no-match' && (\n                                                <View style={styles.scannedNoMatchIndicator}>\n                                                    <View style={styles.noMatchIconContainer}>\n                                                        <Typography weight=\"bold\" style={{ color: 'white', fontSize: 20 }}>✕</Typography>\n                                                    </View>\n                                                    <Typography weight=\"bold\" style={{ color: 'white', marginTop: 4 }}>Item Tidak Ditemukan</Typography>\n                                                </View>\n                                            )}\n                                        </View>\n                                        <View style={styles.unfocusedContainer}></View>\n                                    </View>\n                                    <View style={styles.unfocusedContainer}>\n                                        <View className=\"items-center mt-6\">\n                                            <Typography className=\"text-white text-center mb-6\" style={{ opacity: 0.7 }}>\n                                                {continuous\n                                                    ? 'Scan terus-menerus — arahkan ke barcode berikutnya'\n                                                    : 'Posisikan barcode/QR code di dalam kotak'\n                                                }\n                                            </Typography>\n\n                                            {/* Scanner Log Overlay */}\n                                            {scanLog.length > 0 && (\n                                                <View className=\"w-[90%] bg-black/40 rounded-3xl p-4 border border-white/10 mt-2\">\n                                                    <Typography variant=\"caption\" weight=\"bold\" className=\"text-white/60 mb-3 ml-1 uppercase\" style={{ letterSpacing: 1 }}>History Scan Terakhir</Typography>\n                                                    {scanLog.slice(0, 3).map((item, idx) => (\n                                                        <View key={item.id} className={`flex-row items-center py-2.5 px-3 mb-2 rounded-2xl ${idx === 0 ? 'bg-blue-600/30 border border-blue-500/30' : 'bg-white/5 border border-white/5'}`}>\n                                                            <View className={`w-2 h-2 rounded-full mr-3 ${idx === 0 ? 'bg-blue-400' : 'bg-white/20'}`} />\n                                                            <View className=\"flex-1\">\n                                                                <Typography weight=\"bold\" className=\"text-white text-sm\" numberOfLines={1}>{item.title}</Typography>\n                                                                {item.subtitle && <Typography variant=\"caption\" className=\"text-white/50 text-[10px]\">{item.subtitle}</Typography>}\n                                                            </View>\n                                                            <Typography variant=\"caption\" className=\"text-white/40 ml-2\">Baru saja</Typography>\n                                                        </View>\n                                                    ))}\n                                                    <Typography variant=\"caption\" weight=\"bold\" className=\"text-blue-400 text-center mt-2 mb-4\">Total: {scanLog.length} item tersimpan</Typography>\n\n                                                    <Button\n                                                        title=\"Selesai & Tutup\"\n                                                        variant=\"primary\"\n                                                        onPress={onClose}\n                                                        className=\"h-12 rounded-2xl\"\n                                                    />\n                                                </View>\n                                            )}\n                                        </View>\n                                    </View>\n                                </View>\n                                {/* A11y: screen reader announces scan results for native camera */}\n                                <View\n                                    aria-live=\"assertive\"\n                                    aria-atomic=\"true\"\n                                    style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}\n                                >\n                                    {scanMatch === 'match' ? 'Item ditemukan' : scanMatch === 'no-match' ? 'Item tidak ditemukan' : ''}\n                                </View>\n                            </CameraView>\n                        ) : (\n                            <View className=\"flex-1 items-center justify-center bg-gray-900 px-10\">\n                                {/* Item Scan Mode Badge for Hardware */}\n                                {continuous && (\n                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.85)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 24 }}>\n                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6EE7B7', marginRight: 8 }} />\n                                        <Typography weight=\"bold\" style={{ color: 'white', fontSize: 11 }}>ITEM SCAN</Typography>\n                                        {scanLog.length > 0 && (\n                                            <View style={{ backgroundColor: 'white', borderRadius: 10, marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2 }}>\n                                                <Typography weight=\"bold\" style={{ color: '#059669', fontSize: 11 }}>{scanLog.length}</Typography>\n                                            </View>\n                                        )}\n                                    </View>\n                                )}\n                                <View className=\"w-40 h-40 bg-blue-500/10 rounded-full items-center justify-center mb-8 border border-blue-500/20\">\n                                    <Scan size={64} color=\"#3B82F6\" strokeWidth={1} />\n                                </View>\n                                <Typography variant=\"h3\" weight=\"bold\" className=\"text-white text-center mb-2\">Hardware Mode</Typography>\n                                <Typography className=\"text-gray-400 text-center mb-10\">\n                                    {continuous\n                                        ? 'Scan terus-menerus — arahkan ke barcode berikutnya'\n                                        : 'Arahkan hardware scanner ke barcode dan tekan pelatuk scan.'\n                                    }\n                                </Typography>\n\n                                <Pressable\n                                    onPress={() => hwInputRef.current?.focus()}\n                                    className=\"bg-white/5 border border-white/10 px-6 py-4 rounded-3xl items-center w-full\"\n                                >\n                                    <Typography className=\"text-blue-400 font-bold\">Siap Menerima Scan...</Typography>\n                                </Pressable>\n\n                                {scanLog.length > 0 && (\n                                    <View className=\"mt-8 w-full\">\n                                        <Typography variant=\"caption\" weight=\"bold\" className=\"text-white/40 text-center uppercase mb-4 tracking-widest\">Item Terakhir</Typography>\n                                        <View className=\"bg-white/5 border border-white/10 p-4 rounded-3xl mb-4\">\n                                            <Typography weight=\"bold\" className=\"text-white text-center\">{scanLog[0].title}</Typography>\n                                            <Typography variant=\"caption\" className=\"text-white/50 text-center\">{scanLog[0].subtitle}</Typography>\n                                        </View>\n                                        {continuous && (\n                                            <View>\n                                                <Typography variant=\"caption\" weight=\"bold\" className=\"text-emerald-400 text-center mb-4\">Total: {scanLog.length} item tersimpan</Typography>\n                                                <Button\n                                                    title=\"Selesai & Tutup\"\n                                                    variant=\"primary\"\n                                                    onPress={onClose}\n                                                    className=\"h-12 rounded-2xl\"\n                                                />\n                                            </View>\n                                        )}\n                                    </View>\n                                )}\n                            </View>\n                        )}\n\n                        {/* Hidden Input for Hardware Scanner */}\n                        <TextInput\n                            ref={hwInputRef}\n                            style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}\n                            value={hwInput}\n                            onChangeText={setHwInput}\n                            onSubmitEditing={(e) => {\n                                const code = e.nativeEvent.text;\n                                if (code) {\n                                    handleBarCodeScanned({ type: 'hardware', data: code });\n                                    setHwInput('');\n                                    // Keep focused for next scan\n                                    setTimeout(() => hwInputRef.current?.focus(), 100);\n                                }\n                            }}\n                            autoFocus={visible}\n                            blurOnSubmit={false}\n                        />\n\n                        {/* Controls */}\n                        <View style={styles.header}>\n                            <Pressable\n                                onPress={toggleScannerMode}\n                                style={[styles.iconButton, { width: 'auto', paddingHorizontal: 16 }]}\n                            >\n                                {scannerMode === 'camera' || scannerMode === 'web-camera' ? (\n                                    <View className=\"flex-row items-center\">\n                                        <Scan size={18} color=\"white\" />\n                                        <Typography className=\"text-white text-[10px] ml-2 font-bold uppercase\">To Hardware</Typography>\n                                    </View>\n                                ) : (\n                                    <View className=\"flex-row items-center\">\n                                        <Camera size={18} color=\"white\" />\n                                        <Typography className=\"text-white text-[10px] ml-2 font-bold uppercase\">To Camera</Typography>\n                                    </View>\n                                )}\n                            </Pressable>\n                            <View className=\"flex-row space-x-2\">\n                                {scannerMode === 'camera' && (\n                                    <Pressable onPress={() => setTorch(!torch)} style={styles.iconButton}>\n                                        {torch ? <Zap size={24} color=\"#FBBF24\" /> : <ZapOff size={24} color=\"white\" />}\n                                    </Pressable>\n                                )}\n                                <Pressable onPress={onClose} style={styles.iconButton}>\n                                    <X size={24} color=\"white\" />\n                                </Pressable>\n                            </View>\n                        </View>\n                    </View>\n                )}\n            </View>\n        </View>\n    );\n};\n\nconst styles = StyleSheet.create({\n    container: {\n        flex: 1,\n        backgroundColor: 'black',\n    },\n    permissionContainer: {\n        flex: 1,\n        justifyContent: 'center',\n        alignItems: 'center',\n        padding: 24,\n        backgroundColor: 'white',\n    },\n    cameraContainer: {\n        flex: 1,\n        position: 'relative',\n    },\n    camera: {\n        flex: 1,\n    },\n    header: {\n        position: 'absolute',\n        top: Platform.OS === 'ios' ? 20 : 40,\n        left: 20,\n        right: 20,\n        flexDirection: 'row',\n        justifyContent: 'space-between',\n        zIndex: 10,\n    },\n    iconButton: {\n        width: 44,\n        height: 44,\n        backgroundColor: 'rgba(0,0,0,0.5)',\n        borderRadius: 22,\n        alignItems: 'center',\n        justifyContent: 'center',\n    },\n    overlay: {\n        flex: 1,\n    },\n    unfocusedContainer: {\n        flex: 1,\n        backgroundColor: 'rgba(0,0,0,0.6)',\n    },\n    middleContainer: {\n        flexDirection: 'row',\n        height: 250,\n    },\n    focusedContainer: {\n        width: 250,\n        position: 'relative',\n    },\n    corner: {\n        position: 'absolute',\n        width: 30,\n        height: 30,\n        borderColor: '#3B82F6',\n        borderWidth: 4,\n    },\n    topLeft: {\n        top: 0,\n        left: 0,\n        borderRightWidth: 0,\n        borderBottomWidth: 0,\n        borderTopLeftRadius: 16,\n    },\n    topRight: {\n        top: 0,\n        right: 0,\n        borderLeftWidth: 0,\n        borderBottomWidth: 0,\n        borderTopRightRadius: 16,\n    },\n    bottomLeft: {\n        bottom: 0,\n        left: 0,\n        borderRightWidth: 0,\n        borderTopWidth: 0,\n        borderBottomLeftRadius: 16,\n    },\n    bottomRight: {\n        bottom: 0,\n        right: 0,\n        borderLeftWidth: 0,\n        borderTopWidth: 0,\n        borderBottomRightRadius: 16,\n    },\n    scannedMatchIndicator: {\n        ...StyleSheet.absoluteFillObject,\n        backgroundColor: 'rgba(16, 185, 129, 0.55)',\n        alignItems: 'center',\n        justifyContent: 'center',\n        borderRadius: 16,\n    },\n    scannedNoMatchIndicator: {\n        ...StyleSheet.absoluteFillObject,\n        backgroundColor: 'rgba(239, 68, 68, 0.55)',\n        alignItems: 'center',\n        justifyContent: 'center',\n        borderRadius: 16,\n    },\n    noMatchIconContainer: {\n        width: 36,\n        height: 36,\n        borderRadius: 18,\n        backgroundColor: 'rgba(255,255,255,0.2)',\n        alignItems: 'center',\n        justifyContent: 'center',\n    },\n    laser: {\n        position: 'absolute',\n        left: 10,\n        right: 10,\n        height: 2,\n        backgroundColor: '#3B82F6',\n        shadowColor: \"#3B82F6\",\n        shadowOffset: { width: 0, height: 0 },\n        shadowOpacity: 0.8,\n        shadowRadius: 10,\n        elevation: 10,\n    }\n});\n"
}
Modal rewrite done. Key changes:

- `onScan: (data: string) => boolean | Promise<boolean>` — caller returns `true` (matched) or `false` (not found)
- `playSuccess`/`playError` called by modal based on return value
- **Code 128 bug fixed**: `Html5QrcodeSupportedFormats` was aliased as `Fmts` in destructure but line 160 used the original name → `undefined` at runtime. Now uses `Html5QrcodeSupportedFormats` directly from the import.
- **"CONTINUOUS SCAN" → "ITEM SCAN"** in all 3 mode sections
- **Red no-match overlay** with `✕` icon + "Item Tidak Ditemukan" label, auto-dismiss 1.5s
- **Green match overlay** with `CheckCircle2` icon + "Item Ditemukan!" (continuous) / "Terdeteksi!" (single)
- **Web camera error fallback** with retry button
- **`aria-live="assertive"`** region for screen readers in all 3 scanner modes
- **Volume**: `0.15` → `0.85` done in previous step

Now updating 7 callers to return boolean.