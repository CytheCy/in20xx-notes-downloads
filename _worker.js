const GITHUB_REPOSITORY = 'CytheCy/In20xx_Notes';
const WINDOWS_ASSET_NAME = 'In20xx-Notes-Windows-x64.exe';

function githubHeaders(token, accept = 'application/vnd.github+json') {
    return {
        Accept: accept,
        Authorization: `Bearer ${token}`,
        'User-Agent': 'In20xx-Notes-Downloads',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}

async function downloadLatestWindowsInstaller(env) {
    const token = typeof env.GITHUB_TOKEN === 'string' ? env.GITHUB_TOKEN.trim() : '';
    if (!token) return new Response('Windows downloads are not configured.', { status: 503 });

    const releaseResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/latest`, {
        headers: githubHeaders(token),
    });
    if (!releaseResponse.ok) return new Response('Could not find the latest Windows release.', { status: 502 });

    const release = await releaseResponse.json();
    const asset = Array.isArray(release.assets)
        ? release.assets.find(candidate => candidate.name === WINDOWS_ASSET_NAME || candidate.name.endsWith('.exe'))
        : null;
    if (!asset?.url) return new Response('The latest release has no Windows installer.', { status: 404 });

    const assetResponse = await fetch(asset.url, {
        headers: githubHeaders(token, 'application/octet-stream'),
    });
    if (!assetResponse.ok || !assetResponse.body) {
        return new Response('Could not download the Windows installer.', { status: 502 });
    }

    return new Response(assetResponse.body, {
        headers: {
            'Content-Type': asset.content_type || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${asset.name || WINDOWS_ASSET_NAME}"`,
            ...(asset.size ? { 'Content-Length': String(asset.size) } : {}),
        },
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/downloads/windows/latest') {
            try {
                return await downloadLatestWindowsInstaller(env);
            } catch (error) {
                console.error('Windows download failed:', error);
                return new Response('Could not download the Windows installer.', { status: 502 });
            }
        }
        return env.ASSETS.fetch(request);
    },
};
