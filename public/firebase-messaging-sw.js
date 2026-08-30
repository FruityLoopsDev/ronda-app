importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA55U4CwLAv5tlNPGvO-OkRBB0qJHbTNKQ",
  authDomain: "ronda-uno.firebaseapp.com",
  projectId: "ronda-uno",
  storageBucket: "ronda-uno.firebasestorage.app",
  messagingSenderId: "391712707230",
  appId: "1:391712707230:web:3a5461ef25e71c4dc6e18f",
  measurementId: "G-RH65BSDMP5"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'RONDA';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
