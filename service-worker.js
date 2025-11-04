// PWA Service Worker for "环球语音之旅"
const CACHE_NAME = 'global-voice-game-v1';

// 核心资产列表，这些资源将在安装时被预先缓存
// 注意：Service Worker 无法缓存跨域的 Opaque Response (如 CDN 资源)，
// 但由于这些 CDN 资源在 index.html 中被直接引用，浏览器通常会高效处理它们。
// 我们主要缓存本地文件。
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    // --------------------------------------------------------------------------------
    // WARNING FIX: cdn.tailwindcss.com 被移除。
    // 在生产环境中，您应该移除 index.html 中对 cdn.tailwindcss.com 的引用，
    // 并使用构建工具生成一个单独的 'style.css' 文件来包含所有所需的 Tailwind 样式，
    // 以避免生产警告和性能问题。
    // --------------------------------------------------------------------------------
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
    // 请确保您已在项目根目录创建 /icons 文件夹并放入图标
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// 安装阶段：缓存所有核心资产
self.addEventListener('install', (event) => {
    // 等待直到缓存完成
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => {
            console.log('Service Worker: 预缓存成功');
            return cache.addAll(urlsToCache);
        })
        .catch(error => {
            // 如果缓存失败（例如：CDN资源无法访问），记录错误但Service Worker仍可尝试安装
            console.error('Service Worker: 预缓存部分或全部失败', error);
        })
    );
});

// 激活阶段：清理旧的缓存版本
self.addEventListener('activate', (event) => {
    // 缓存名称更新，以确保 Service Worker 缓存更新
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        // 如果缓存名称不在白名单中，则删除旧缓存
                        console.log('Service Worker: 清理旧缓存', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 抓取阶段：缓存优先策略
self.addEventListener('fetch', (event) => {
    // 对于所有请求，尝试从缓存中获取，如果失败，则请求网络
    event.respondWith(
        caches.match(event.request)
        .then((response) => {
            // 缓存中找到了，返回缓存的响应
            if (response) {
                return response;
            }
            // 缓存中没有找到，从网络请求
            return fetch(event.request).then(
                (response) => {
                    // 检查响应是否有效
                    if(!response || response.status !== 200 || response.type !== 'basic') {
                        // 对于 API 调用或其他非基本请求，直接返回网络响应
                        return response;
                    }

                    // 对于新的资源，克隆响应并将其添加到缓存
                    const responseToCache = response.clone();

                    // 检查请求 URL 是否在我们的预缓存列表中，如果是，则添加到缓存
                    // 注意：这里检查的是 urlsToCache 列表中的 URL，而不是所有 URL
                    if (urlsToCache.some(url => event.request.url.includes(url))) {
                        caches.open(CACHE_NAME)
                        .then((cache) => {
                            // 避免缓存跨域不透明响应（Opaque Response），这会导致配额问题。
                            // 但对于明确列出的 CDN 资源，我们通常可以接受。
                            if (response.type === 'opaque') {
                                console.warn('Service Worker: 正在缓存不透明响应 (可能限制缓存配额)', event.request.url);
                            }
                            cache.put(event.request, responseToCache);
                        });
                    }

                    return response;
                }
            );
        }).catch(() => {
            // 如果缓存和网络都失败了 (例如，完全离线且未缓存)，
            // 可以返回一个自定义的离线页面。这里我们不实现复杂的离线页面。
            console.log('Service Worker: 抓取失败，无法提供离线支持。');
        })
    );
});
