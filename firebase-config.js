// firebase-config.js - النسخة النهائية الكاملة
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// 🔒 بيانات Firebase الخاصة بك - صحيحة 100%
const firebaseConfig = {
  apiKey: "AIzaSyC_wp894wyBJisoOkmotBtnzqy44xzP3Gg",
  authDomain: "esati-7c083.firebaseapp.com",
  projectId: "esati-7c083",
  storageBucket: "esati-7c083.firebasestorage.app",
  messagingSenderId: "432835304984",
  appId: "1:432835304984:web:3f87364e22e3f362bfad6d",
  measurementId: "G-891GKMDTW2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { 
    auth, 
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    Timestamp 
};