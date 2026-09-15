const { execSync } = require('child_process');

// Commit SHA dibaca saat bundling (EAS meng-clone repo, jadi .git tersedia).
const commitFromGit = () => {
    try {
        return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
        return undefined;
    }
};

module.exports = ({ config }) => ({
    ...config,
    extra: {
        ...config.extra,
        commit: process.env.EXPO_PUBLIC_COMMIT || commitFromGit() || 'unknown',
    },
});
