import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

interface BarcodeProps {
    value: string;
    width?: number;
    height?: number;
    showText?: boolean;
}

/**
 * A simple Code 39 Barcode Generator using SVG
 * This implementation is lightweight and works offline.
 */
export const Barcode: React.FC<BarcodeProps> = ({
    value,
    width = 200,
    height = 100,
    showText = true,
}) => {
    // Code 39 character map (simplified for Alpha-Numeric)
    const code39Map: { [key: string]: string } = {
        '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
        '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
        '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
        'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101',
        'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
        'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
        'O': '110101101001', 'P': '101101101001', 'Q': '101010110011', 'R': '110101011001',
        'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011',
        'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100111010101',
        '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101',
        '$': '100100100101', '/': '100100101001', '+': '100101001001', '%': '101001001001',
    };

    const encode = (text: string) => {
        const fullText = `*${text.toUpperCase()}*`;
        let result = '';
        for (let i = 0; i < fullText.length; i++) {
            const char = fullText[i];
            const pattern = code39Map[char] || code39Map[' '];
            result += pattern + '0'; // Add a gap between characters
        }
        return result;
    };

    const encoded = encode(value);
    const barWidth = width / encoded.length;

    return (
        <View style={{ alignItems: 'center', backgroundColor: 'white', padding: 10 }}>
            <Svg width={width} height={height}>
                {encoded.split('').map((bit, index) => (
                    bit === '1' ? (
                        <Rect
                            key={index}
                            x={index * barWidth}
                            y={0}
                            width={barWidth}
                            height={height - (showText ? 20 : 0)}
                            fill="black"
                        />
                    ) : null
                ))}
                {showText && (
                    <SvgText
                        x={width / 2}
                        y={height}
                        textAnchor="middle"
                        fontSize="12"
                        fill="black"
                        fontFamily="monospace"
                    >
                        {value}
                    </SvgText>
                )}
            </Svg>
        </View>
    );
};
