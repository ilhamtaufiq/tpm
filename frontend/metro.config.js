const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('txt')) {
    config.resolver.assetExts.push('txt');
}

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

module.exports = withNativeWind(config, {
    input: "./global.css",
});
