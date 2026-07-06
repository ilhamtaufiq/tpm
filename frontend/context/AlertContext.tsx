import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertDialog } from '../components/ui/AlertDialog';
import { setAppAlertHandler, type AppAlertOptions } from '../utils/appAlert';

export type AlertOptions = AppAlertOptions;

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

    useEffect(() => {
        setAppAlertHandler(showAlert);
        return () => setAppAlertHandler(null);
    }, [showAlert]);

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
