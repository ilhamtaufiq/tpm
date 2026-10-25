module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            ["babel-preset-expo", { jsxImportSource: "nativewind" }],
            "nativewind/babel",
        ],
        plugins: ["react-native-reanimated/plugin"],
        env: {
            // Build produksi: buang console.log/info/debug. error dan warn tetap dipertahankan.
            production: {
                plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]],
            },
        },
    };
};
