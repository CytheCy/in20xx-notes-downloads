const GITHUB_REPOSITORY = 'CytheCy/in20xx-notes-downloads';
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/latest`;
const RELEASE_CACHE_SECONDS = 300;

const DOWNLOADS = {
    '/downloads/windows-x64.exe': { extension: '.exe', arch: 'x64' },
    '/downloads/macos-x64.zip': { extension: '.zip', arch: 'x64' },
    '/downloads/macos-arm64.zip': { extension: '.zip', arch: 'arm64' },
    '/downloads/linux-amd64.deb': { extension: '.deb', arch: 'x64' },
    '/downloads/linux-x86_64.rpm': { extension: '.rpm', arch: 'x64' },
    '/downloads/linux-x86_64.appimage': { extension: '.appimage', arch: 'x64' },
};

function githubHeaders(token) {
    const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'In20xx-Notes-Downloads',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function architecture(name) {
    const lower = name.toLowerCase();
    if (/(^|[-_.])(arm64|aarch64)([-_.]|$)/.test(lower)) return 'arm64';
    if (/(^|[-_.])(x64|x86_64|amd64)([-_.]|$)/.test(lower)) return 'x64';
    return '';
}

async function latestRelease(env) {
    const token = typeof env.GITHUB_TOKEN === 'string' ? env.GITHUB_TOKEN.trim() : '';
    const releaseResponse = await fetch(LATEST_RELEASE_API, {
        headers: githubHeaders(token),
        cf: { cacheEverything: true, cacheTtl: RELEASE_CACHE_SECONDS },
    });
    if (!releaseResponse.ok) throw new Error(`GitHub returned ${releaseResponse.status}`);
    return releaseResponse.json();
}

function findAsset(release, definition) {
    return Array.isArray(release.assets)
        ? release.assets.find(candidate => (
            candidate.name.toLowerCase().endsWith(definition.extension) &&
            architecture(candidate.name) === definition.arch
        ))
        : null;
}

async function redirectToLatestDownload(env, definition) {
    const release = await latestRelease(env);
    const asset = findAsset(release, definition);
    if (!asset?.browser_download_url) {
        return new Response('The latest release does not include this download.', { status: 404 });
    }

    return new Response(null, {
        status: 302,
        headers: {
            Location: asset.browser_download_url,
            'Cache-Control': 'no-store',
        },
    });
}

async function releaseMetadata(env) {
    const release = await latestRelease(env);
    const assets = Array.isArray(release.assets)
        ? release.assets.map(({ name, size, browser_download_url }) => ({ name, size, browser_download_url }))
        : [];

    return Response.json({
        tag_name: release.tag_name,
        published_at: release.published_at,
        created_at: release.created_at,
        html_url: release.html_url,
        assets,
    }, {
        headers: { 'Cache-Control': `public, max-age=${RELEASE_CACHE_SECONDS}` },
    });
}

function errorResponse(message, error) {
    console.error(message, error);
    return new Response(message, {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/api/releases/latest') {
            try {
                return await releaseMetadata(env);
            } catch (error) {
                return errorResponse('Could not load the latest release.', error);
            }
        }

        const definition = DOWNLOADS[url.pathname];
        if (definition) {
            try {
                return await redirectToLatestDownload(env, definition);
            } catch (error) {
                return errorResponse('Could not find the latest download.', error);
            }
        }

        return env.ASSETS.fetch(request);
    }
};
