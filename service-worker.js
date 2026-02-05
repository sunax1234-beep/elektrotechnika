// Názov cache a verzia (zmeňte verziu, ak urobíte zmeny v kóde a chcete, aby sa natiahla nová verzia)
const CACHE_NAME = 'energo-testy-v1'; 

// Zoznam všetkých súborov, ktoré chceme cachovať (uložiť pre offline)
const urlsToCache = [
    '/index.html',
    '/style.css',
    '/script.js',
    '/questions.json', 
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// --- 1. Inštalácia Service Workera a uloženie súborov do cache ---
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Inštalácia. Cachujem súbory.');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Service Worker: Chyba pri cachovaní súborov.', error);
            })
    );
    // Force aktivácia Service Workera, aby sa spustil ihneď
    self.skipWaiting();
});

// --- 2. Načítavanie z cache pri požiadavke ---
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Ak je súbor v cache, vráť ho odtiaľ
                if (response) {
                    return response;
                }
                // Ak nie je v cache, skús ho načítať zo siete
                return fetch(event.request);
            })
    );
});

// --- 3. Aktivácia (Čistenie starej cache) ---
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Odstráň staré verzie cache
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Uisti sa, že Service Worker prevezme kontrolu
    return self.clients.claim();
});