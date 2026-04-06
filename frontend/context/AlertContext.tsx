import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertDialog } from '../components/ui/AlertDialog';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';
type AlertType = 'alert' | 'confirm';

interface AlertOptions {
    title: string;
    message: string;
    variant?: AlertVariant;
    type?: AlertType;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onClose?: () => void;
}

interface AlertContextData {
    showAlert: (options: AlertOptions) => void;
    hideAlert: () => void;
}

const AlertContext = createContext<AlertContextData>({} as AlertContextData);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertOptions>({
        title: '',
        message: '',
        variant: 'info',
        type: 'alert',
    });

    const showAlert = useCallback((options: AlertOptions) => {
        setConfig(options);
        setVisible(true);
    }, []);

    const hideAlert = useCallback(() => {
        setVisible(false);
        if (config.onClose) config.onClose();
    }, [config]);

    const handleConfirm = useCallback(() => {
        setVisible(false);
        if (config.onConfirm) config.onConfirm();
    }, [config]);

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            <AlertDialog
                visible={visible}
                title={config.title}
                message={config.message}
                variant={config.variant}
                type={config.type}
                confirmText={config.confirmText}
                cancelText={config.cancelText}
                onConfirm={handleConfirm}
                onClose={hideAlert}
            />
        </AlertContext.Provider>
    );
};

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};
