const firebaseConfig = {
  apiKey: "AIzaSyCLB8tCB6lkHEvnS74RUrKFUS57uDRrmQc",
  authDomain: "thptlehongphong-6c6fe.firebaseapp.com",
  databaseURL: "https://thptlehongphong-6c6fe-default-rtdb.firebaseio.com",
  projectId: "thptlehongphong-6c6fe",
  storageBucket: "thptlehongphong-6c6fe.firebasestorage.app",
  messagingSenderId: "2601919264",
  appId: "1:2601919264:web:3b3cb6cb4c13957662ed45",
  measurementId: "G-WGFH09SJ3J"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const rootRef = db.ref("Kyluat");
