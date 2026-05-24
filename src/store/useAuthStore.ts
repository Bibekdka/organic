/* eslint-disable no-unused-vars */
import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  setUser: (u: User | null) => void;
  setLoading: (l: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));

// Initialize listener
onAuthStateChanged(auth, async (firebaseUser) => {
  const store = useAuthStore.getState();
  
  if (firebaseUser) {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    let currentUserData: User;
    
    if (userSnap.exists()) {
      currentUserData = userSnap.data() as User;
      store.setUser(currentUserData);
    } else {
      currentUserData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        createdAt: Date.now(),
      };
      await setDoc(userRef, currentUserData);
      store.setUser(currentUserData);
    }

    // Bridge/link a manually added member to this authenticated user if email matches
    if (currentUserData.email) {
      try {
        const membersRef = collection(db, 'members');
        const q = query(membersRef, where('email', '==', currentUserData.email));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          qSnap.forEach(async (memberDoc) => {
            const data = memberDoc.data();
            if (!data.userId || data.userId !== currentUserData.uid) {
              await updateDoc(doc(db, 'members', memberDoc.id), {
                userId: currentUserData.uid
              });
            }
          });
        }
      } catch (err) {
        window.console.error("Failed to link manual member with logged in user UID:", err);
      }
    }


  } else {
    store.setUser(null);
  }
  
  useAuthStore.setState({ loading: false, initialized: true });
});
