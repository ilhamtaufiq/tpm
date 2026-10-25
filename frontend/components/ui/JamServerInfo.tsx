import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { format } from 'date-fns/format';
import { id as localeID } from 'date-fns/locale/id';
import { Typography } from './Typography';
import { serverNow } from '../../utils/format';

// Tanggal dan jam WIB (detik) menurut jam server, diperbarui tiap detik.
export const JamServerInfo = () => {
    const [sekarang, setSekarang] = useState(() => serverNow());

    useEffect(() => {
        const timer = setInterval(() => setSekarang(serverNow()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <View className="flex-row items-center gap-2 mt-0.5">
            <Typography variant="caption" className="text-textGray" numberOfLines={1}>
                {format(sekarang, 'EEEE, dd MMM yyyy', { locale: localeID })}
            </Typography>
            <Typography variant="caption" weight="bold" className="text-primary">
                {format(sekarang, 'HH:mm:ss')} WIB
            </Typography>
        </View>
    );
};
