import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '../../../components/ui/Header';
import SparepartForm from '../../../components/forms/SparepartForm';

export default function CreateSparepartScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-surface">
            <Header title="Tambah Sparepart" showBackButton onBackButtonPress={router.back} />
            <ScrollView className="flex-1">
                <SparepartForm onSuccess={() => router.back()} />
            </ScrollView>
        </View>
    );
}
