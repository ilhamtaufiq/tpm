const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("txt")) {
    config.resolver.assetExts.push("txt");
}

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["react-native", "browser", "require"];

// Prefer filesystem paths under this app (Node core "buffer" name collides with npm package).
const nm = (pkg) => path.resolve(__dirname, "node_modules", pkg);

// Node core shims — pngjs (thermal logo) and related packages require stream/buffer.
config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    stream: nm("readable-stream"),
    buffer: nm("buffer"),
};

// Force browserified pngjs (avoids lib/png.js → require('stream')).
const pngjsBrowser = path.resolve(__dirname, "node_modules/pngjs/browser.js");
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "pngjs" || moduleName === "pngjs/browser") {
        return { filePath: pngjsBrowser, type: "sourceFile" };
    }
    if (defaultResolveRequest) {
        return defaultResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
    input: "./global.css",
});
