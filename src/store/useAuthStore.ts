import { create } from 'zustand';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
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
    
    if (userSnap.exists()) {
      store.setUser(userSnap.data() as User);
    } else {
      const newUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        createdAt: Date.now(),
      };
      await setDoc(userRef, newUser);
      store.setUser(newUser);
    }
  } else {
    store.setUser(null);
  }
  
  useAuthStore.setState({ loading: false, initialized: true });
});
