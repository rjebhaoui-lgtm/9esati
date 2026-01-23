// اسم التخزين المؤقت
const CACHE_NAME = '9esati-v2';

// الملفات للتخزين المؤقت
const urlsToCache = [
  '/9esati/',
  '/9esati/index.html',
  '/9esati/style.css',
  '/9esati/script.js',
  '/9esati/firebase-config.js',
  '/9esati/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  console.log('🛠️ Service Worker جاري التثبيت...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 جاري تخزين الملفات في الذاكرة المؤقتة');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ تم تثبيت Service Worker بنجاح');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ خطأ في تثبيت Service Worker:', error);
      })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker جاري التفعيل...');
  
  // حذف التخزين المؤقت القديم
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ جاري حذف التخزين المؤقت القديم: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker مفعل وجاهز للعمل');
      return self.clients.claim();
    })
  );
});

// اعتراض طلبات الشبكة
self.addEventListener('fetch', event => {
  // تجاهل طلبات Firebase وGoogle Analytics
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('google-analytics')) {
    return;
  }
  
  // استراتيجية Cache First مع تحديث الشبكة
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // العودة من الذاكرة المؤقتة إذا كان الملف موجوداً
        if (response) {
          console.log('📂 جاري تحميل من الذاكرة المؤقتة:', event.request.url);
          return response;
        }
        
        // إذا لم يكن موجوداً، جلب من الشبكة
        console.log('🌐 جاري تحميل من الإنترنت:', event.request.url);
        return fetch(event.request)
          .then(response => {
            // التأكد من أن الطلب ناجح
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // تخزين في الذاكرة المؤقتة للمرة القادمة
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.error('❌ خطأ في جلب المورد:', error);
            
            // إذا فشل الجلب، حاول تقديم صفحة بديلة
            if (event.request.mode === 'navigate') {
              return caches.match('/9esati/index.html');
            }
            
            return new Response('عذراً، لا يوجد اتصال بالإنترنت', {
              status: 408,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          });
      })
  );
});

// دفع الإشعارات
self.addEventListener('push', event => {
  console.log('📢 حدث Push:', event);
  
  if (!event.data) return;
  
  const data = event.data.json();
  const title = data.title || '9esati';
  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: 'https://cdn-icons-png.flaticon.com/512/2237/2237987.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/2237/2237987.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/9esati/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// النقر على الإشعار
self.addEventListener('notificationclick', event => {
  console.log('👆 تم النقر على الإشعار:', event.notification.data);
  
  event.notification.close();
  
  // فتح الموقع عند النقر على الإشعار
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || '/9esati/');
        }
      })
  );
});