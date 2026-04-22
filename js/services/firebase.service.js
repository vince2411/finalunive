/**
 * Firebase Service — Universitarios FC v2.0
 * Handles Firebase initialization, Firestore CRUD, Auth, and Storage
 */
import { firebaseConfig } from './firebase.config.js';

// Firebase SDK loaded via CDN in HTML
const getFirebase = () => window.firebase;
let app = null;
let db = null;
let auth = null;
let storage = null;
let isInitialized = false;

/**
 * Check if Firebase config has real (non-placeholder) values
 */
function isFirebaseConfigured() {
  return firebaseConfig.apiKey && 
         !firebaseConfig.apiKey.includes('YOUR_') &&
         firebaseConfig.projectId && 
         !firebaseConfig.projectId.includes('YOUR_');
}

/**
 * Initialize Firebase services
 */
export function initFirebase() {
  // Skip Firebase if config has placeholder values
  if (!isFirebaseConfigured()) {
    console.warn('[Firebase] Config contains placeholder values. Using localStorage fallback.');
    console.info('[Firebase] Replace values in firebase.config.js with your actual Firebase project credentials.');
    return false;
  }
  
  const firebase = getFirebase();
  if (!firebase) {
    console.warn('[Firebase] SDK not loaded. Using localStorage fallback.');
    return false;
  }
  
  try {
    if (!firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
    } else {
      app = firebase.apps[0];
    }
    
    db = firebase.firestore();
    auth = firebase.auth();
    
    if (firebase.storage) {
      storage = firebase.storage();
    }
    
    isInitialized = true;
    console.log('[Firebase] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
    return false;
  }
}

export function isFirebaseReady() {
  return isInitialized && db !== null;
}

// ==================== AUTHENTICATION ====================

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  if (!auth) {
    // Fallback: simple password check
    return fallbackAuth(password);
  }
  
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, message: translateAuthError(error.code) };
  }
}

/**
 * Sign out
 */
export async function signOut() {
  if (auth) {
    await auth.signOut();
  }
  localStorage.removeItem('ufc_session');
}

/**
 * Monitor auth state changes
 */
export function onAuthChange(callback) {
  if (!auth) {
    const session = localStorage.getItem('ufc_session');
    callback(session ? { email: 'admin@universitariosfc.com' } : null);
    return () => {};
  }
  return auth.onAuthStateChanged(callback);
}

/**
 * Fallback authentication when Firebase is not configured
 */
function fallbackAuth(password) {
  if (password === 'Vasm2007$') {
    localStorage.setItem('ufc_session', JSON.stringify({ 
      authenticated: true, 
      email: 'admin@universitariosfc.com',
      loginAt: Date.now() 
    }));
    return { success: true, user: { email: 'admin@universitariosfc.com' } };
  }
  return { success: false, message: 'Credenciales inválidas' };
}

function translateAuthError(code) {
  const errors = {
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/invalid-email': 'Email inválido',
    'auth/user-disabled': 'Cuenta deshabilitada',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
    'auth/network-request-failed': 'Error de conectividad'
  };
  return errors[code] || 'Error de autenticación';
}

// ==================== FIRESTORE CRUD ====================

/**
 * Get all documents from a collection
 */
export async function getCollection(collectionName, options = {}) {
  if (!db) return getLocalCollection(collectionName);
  
  try {
    let query = db.collection(collectionName);
    
    if (options.where) {
      options.where.forEach(([field, op, value]) => {
        query = query.where(field, op, value);
      });
    }
    
    if (options.orderBy) {
      query = query.orderBy(options.orderBy[0], options.orderBy[1] || 'asc');
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`[Firestore] Error fetching ${collectionName}:`, error);
    return getLocalCollection(collectionName);
  }
}

/**
 * Get a single document
 */
export async function getDocument(collectionName, docId) {
  if (!db) return getLocalDocument(collectionName, docId);
  
  try {
    const doc = await db.collection(collectionName).doc(docId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (error) {
    console.error(`[Firestore] Error fetching document:`, error);
    return getLocalDocument(collectionName, docId);
  }
}

/**
 * Add a document to a collection
 */
export async function addDocument(collectionName, data) {
  const docData = {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  if (!db) return addLocalDocument(collectionName, docData);
  
  try {
    const ref = await db.collection(collectionName).add(docData);
    return { id: ref.id, ...docData };
  } catch (error) {
    console.error(`[Firestore] Error adding document:`, error);
    return addLocalDocument(collectionName, docData);
  }
}

/**
 * Update a document
 */
export async function updateDocument(collectionName, docId, data) {
  const updateData = { ...data, updatedAt: Date.now() };
  
  if (!db) return updateLocalDocument(collectionName, docId, updateData);
  
  try {
    await db.collection(collectionName).doc(docId).update(updateData);
    return { id: docId, ...updateData };
  } catch (error) {
    console.error(`[Firestore] Error updating document:`, error);
    return updateLocalDocument(collectionName, docId, updateData);
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(collectionName, docId) {
  if (!db) return deleteLocalDocument(collectionName, docId);
  
  try {
    await db.collection(collectionName).doc(docId).delete();
    return true;
  } catch (error) {
    console.error(`[Firestore] Error deleting document:`, error);
    return deleteLocalDocument(collectionName, docId);
  }
}

/**
 * Set a document (upsert)
 */
export async function setDocument(collectionName, docId, data, merge = true) {
  if (!db) return updateLocalDocument(collectionName, docId, data);
  
  try {
    await db.collection(collectionName).doc(docId).set(data, { merge });
    return { id: docId, ...data };
  } catch (error) {
    console.error(`[Firestore] Error setting document:`, error);
    return updateLocalDocument(collectionName, docId, data);
  }
}

/**
 * Real-time listener for a collection
 */
export function listenToCollection(collectionName, callback) {
  if (db) {
    return db.collection(collectionName).onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, error => {
      console.error(`[Firestore] Error listening to ${collectionName}:`, error);
    });
  } else {
    // LocalStorage fallback sync using Storage event
    const handleStorage = (e) => {
      if (e.key === `ufc_${collectionName}`) {
        try {
          const list = JSON.parse(e.newValue || '[]');
          callback(list);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    // Return unsubscribe function
    return () => window.removeEventListener('storage', handleStorage);
  }
}

/**
 * Listen to real-time changes on a collection
 */
export function onCollectionChange(collectionName, callback, options = {}) {
  if (!db) {
    callback(getLocalCollection(collectionName));
    return () => {};
  }
  
  let query = db.collection(collectionName);
  
  if (options.where) {
    options.where.forEach(([field, op, value]) => {
      query = query.where(field, op, value);
    });
  }
  
  if (options.orderBy) {
    query = query.orderBy(options.orderBy[0], options.orderBy[1] || 'asc');
  }
  
  return query.onSnapshot(snapshot => {
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(docs);
  });
}

/**
 * Listen to a single document
 */
export function onDocumentChange(collectionName, docId, callback) {
  if (!db) {
    callback(getLocalDocument(collectionName, docId));
    return () => {};
  }
  
  return db.collection(collectionName).doc(docId).onSnapshot(doc => {
    callback(doc.exists ? { id: doc.id, ...doc.data() } : null);
  });
}

// ==================== LOCAL STORAGE FALLBACK ====================

function getStorageKey(collection) {
  return `ufc_${collection}`;
}

function getLocalCollection(collection) {
  try {
    const data = localStorage.getItem(getStorageKey(collection));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function getLocalDocument(collection, docId) {
  const items = getLocalCollection(collection);
  return items.find(item => item.id === docId) || null;
}

function addLocalDocument(collection, data) {
  const items = getLocalCollection(collection);
  const doc = { id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, ...data };
  items.push(doc);
  localStorage.setItem(getStorageKey(collection), JSON.stringify(items));
  return doc;
}

function updateLocalDocument(collection, docId, data) {
  let items = getLocalCollection(collection);
  const idx = items.findIndex(item => item.id === docId);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...data };
    localStorage.setItem(getStorageKey(collection), JSON.stringify(items));
    return items[idx];
  }
  // If document doesn't exist, create it
  return addLocalDocument(collection, { id: docId, ...data });
}

function deleteLocalDocument(collection, docId) {
  let items = getLocalCollection(collection);
  items = items.filter(item => item.id !== docId);
  localStorage.setItem(getStorageKey(collection), JSON.stringify(items));
  return true;
}

// ==================== STORAGE ====================

/**
 * Upload file to Firebase Storage (or return local URL)
 */
export async function uploadFile(path, file) {
  if (!storage) {
    return URL.createObjectURL(file);
  }
  
  try {
    const ref = storage.ref(path);
    await ref.put(file);
    return await ref.getDownloadURL();
  } catch (error) {
    console.error('[Storage] Upload failed:', error);
    return URL.createObjectURL(file);
  }
}
