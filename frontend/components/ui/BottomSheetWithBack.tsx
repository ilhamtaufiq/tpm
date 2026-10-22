import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { BackHandler } from 'react-native';
import BottomSheetBase, { BottomSheetProps } from '@gorhom/bottom-sheet';

// BottomSheet yang menutup dirinya saat tombol back HP/laptop ditekan (saat sheet terbuka).
// Ref tetap berfungsi seperti BottomSheet biasa (snapToIndex, close, dst).
const BottomSheetWithBack = forwardRef<any, BottomSheetProps & { children?: React.ReactNode }>(function BottomSheetWithBack(props, forwardedRef) {
    const innerRef = useRef<any>(null);
    useImperativeHandle(forwardedRef, () => innerRef.current);

    const terbuka = (props.index ?? -1) >= 0;
    const { onClose } = props;

    useEffect(() => {
        if (!terbuka) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (onClose) onClose();
            else innerRef.current?.close?.();
            return true;
        });
        return () => sub.remove();
    }, [terbuka, onClose]);

    return <BottomSheetBase ref={innerRef} {...(props as BottomSheetProps)}>{props.children}</BottomSheetBase>;
});

export default BottomSheetWithBack;
