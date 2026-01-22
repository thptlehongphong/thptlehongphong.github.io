const firebaseConfig = {
  apiKey: "AIzaSyAn9bru0OTL7yIcs273lzf00DDlbh56p_E",
  authDomain: "stickrun-74342.firebaseapp.com",
  databaseURL: "https://stickrun-74342-default-rtdb.firebaseio.com",
  projectId: "stickrun-74342",
  storageBucket: "stickrun-74342.firebasestorage.app",
  messagingSenderId: "11726277617",
  appId: "1:11726277617:web:d027496a1524c2492f1250",
  measurementId: "G-LNP3JZPCHL",
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const rootRef = db.ref("Kyluat");
