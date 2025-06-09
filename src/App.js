import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

// Ces variables globales seront normalement fournies par votre environnement d'hébergement.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'foodathome-app'; // Default ID for GitHub Pages
const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : process.env.REACT_APP_FIREBASE_CONFIG;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const firebaseConfig = (() => {
    try {
        if (!firebaseConfigStr) {
             console.warn("Firebase config string is missing.");
             return {};
        }
        return JSON.parse(firebaseConfigStr);
    } catch (e) {
        console.error("Erreur lors de l'analyse de la configuration Firebase:", e);
        return {}; 
    }
})();

const FirebaseContext = createContext(null);

function usePersistentState(key, initialValue) {
    const [state, setState] = useState(() => {
        let valueToReturn = typeof initialValue === 'function' ? initialValue() : initialValue;
        try {
            const storedValue = localStorage.getItem(key);
            if (storedValue !== null && storedValue !== undefined && storedValue !== "") {
                valueToReturn = JSON.parse(storedValue);
            }
        } catch (error) {
            console.error(`Erreur de lecture de localStorage pour la clé "${key}".`, error);
        }
        return valueToReturn;
    });

    useEffect(() => {
        try {
            if (state === undefined) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(state));
            }
        } catch (error) {
            console.error(`Erreur d'écriture dans localStorage pour la clé "${key}".`, error);
        }
    }, [key, state]);

    return [state, setState];
}

function FirebaseProvider({ children }) {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        if (Object.keys(firebaseConfig).length === 0) {
            console.warn("Configuration Firebase vide. L'initialisation est sautée.");
            setIsAuthReady(true);
            return;
        }

        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);
        setDb(firestoreDb);
        setAuth(firebaseAuth);

        const signInUser = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(firebaseAuth, initialAuthToken);
                } else {
                    await signInAnonymously(firebaseAuth);
                }
            } catch (error) {
                console.error("Erreur d'authentification Firebase:", error);
            }
        };

        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
            setUserId(user ? user.uid : null);
            setIsAuthReady(true);
        });

        signInUser();
        return () => unsubscribe();
    }, []);

    return (
        <FirebaseContext.Provider value={{ db, auth, userId, isAuthReady }}>
            {children}
        </FirebaseContext.Provider>
    );
}

function useFirebase() {
    return useContext(FirebaseContext);
}

function Modal({ message, onConfirm, onCancel, showCancel = false, children }) {
    if (!message && !children) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-blue-500 text-center max-w-md w-full">
                {message && <p className="text-xl text-white mb-6" style={{ whiteSpace: 'pre-wrap' }}>{message}</p>}
                {children}
                <div className={`flex ${children ? 'justify-end' : 'justify-center'} gap-4 mt-6`}>
                    <button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition transform hover:scale-105">
                        {children && !showCancel ? 'Fermer' : 'OK'}
                    </button>
                    {showCancel && <button onClick={onCancel} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition transform hover:scale-105">Annuler</button>}
                </div>
            </div>
        </div>
    );
}

function HomePage({ setPage }) {
    const [code, setCode] = usePersistentState('homePage_menuCode_foodathome', '');
    const [modalMessage, setModalMessage] = useState('');

    const handleFamilyAccess = () => {
        if (code.trim() === '') {
            setModalMessage("Veuillez entrer un code de menu.");
            return;
        }
        setPage('familyOrder', { menuCode: code.trim().toUpperCase() });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4" style={{ background: 'linear-gradient(to bottom right, #1a202c, #2d3748)'}}>
            <h1 className="text-5xl font-bold mb-8 text-blue-400">FoodatHome</h1>
            <p className="text-lg text-gray-300 mb-10 text-center max-w-xl">Bienvenue ! Choisissez votre rôle.</p>
            <div className="flex flex-col md:flex-row gap-8 w-full max-w-2xl">
                <div className="flex-1 bg-gray-800 p-8 rounded-xl shadow-xl border border-purple-600">
                    <h2 className="text-3xl font-bold mb-6 text-purple-400">Je suis le Chef</h2>
                    <button onClick={() => setPage('chefDashboard')} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-4 px-6 rounded-lg">Accéder au Tableau de Bord</button>
                </div>
                <div className="flex-1 bg-gray-800 p-8 rounded-xl shadow-xl border border-green-600">
                    <h2 className="text-3xl font-bold mb-6 text-green-400">J'ai un Code</h2>
                    <input type="text" placeholder="Entrez le code du menu" className="w-full p-3 mb-4 rounded-md bg-gray-700 text-white" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
                    <button onClick={handleFamilyAccess} className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 px-6 rounded-lg">Commander</button>
                </div>
            </div>
            <Modal message={modalMessage} onConfirm={() => setModalMessage('')} />
        </div>
    );
}

async function publishMenu(db, menuData, chefId, menuIdOriginal) {
    if (!db || !menuData || !menuData.code || !chefId || !menuIdOriginal) return;
    try {
        const publishedMenuRef = doc(db, `artifacts/${appId}/public/data/published_menus`, menuData.code);
        await setDoc(publishedMenuRef, {
            name: menuData.name, code: menuData.code,
            items: menuData.items || [], categories: menuData.categories || [],
            chefId: chefId, menuId_original: menuIdOriginal,
            updatedAt: new Date(),
        });
    } catch (error) { console.error("Erreur de publication du menu:", error); }
}

function ChefDashboard({ setPage }) {
    const { db, userId, isAuthReady } = useFirebase();
    const [menus, setMenus] = useState([]);
    const [newMenuName, setNewMenuName] = usePersistentState('chefDashboard_newMenuName_foodathome', '');
    const persistentSelectedMenuKey = `chefDashboard_selectedMenu_${userId || 'guest'}_foodathome`;
    const [selectedMenu, setSelectedMenu] = usePersistentState(persistentSelectedMenuKey, null);
    const [orders, setOrders] = useState([]);
    const [modalMessage, setModalMessage] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [menuToDelete, setMenuToDelete] = useState(null);

    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const q = query(collection(db, `artifacts/${appId}/users/${userId}/menus`));
        const unsubscribe = onSnapshot(q, snapshot => {
            const fetchedMenus = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMenus(fetchedMenus);
            if (selectedMenu && !fetchedMenus.find(m => m.id === selectedMenu.id)) {
                setSelectedMenu(null);
            }
        }, err => console.error("Erreur lecture menus:", err));
        return unsubscribe;
    }, [db, userId, isAuthReady, selectedMenu, setSelectedMenu]);

    useEffect(() => {
        if (!db || !selectedMenu?.code) { setOrders([]); return; }
        const q = query(collection(db, `artifacts/${appId}/public/data/orders`), where("menuCode", "==", selectedMenu.code));
        const unsubscribe = onSnapshot(q, snapshot => {
            setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, err => console.error("Erreur lecture commandes:", err));
        return unsubscribe;
    }, [db, selectedMenu]);

    const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const createNewMenu = async () => { /* ... implementation from previous steps ... */ };
    const handleDeleteMenu = (menu) => { /* ... implementation from previous steps ... */ };
    const confirmDeleteMenu = async () => { /* ... implementation from previous steps ... */ };
    const handleShareBySms = (menuCode) => { /* ... implementation from previous steps ... */ };
    const calculateOrderTotal = (orderItems) => orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
         <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-4" style={{ background: 'linear-gradient(to bottom right, #1a202c, #2d3748)'}}>
            <h1 className="text-4xl font-bold mb-8 text-purple-400">Tableau de Bord du Chef</h1>
            <button onClick={() => setPage('home')} className="absolute top-4 left-4 bg-gray-700 hover:bg-gray-600 py-2 px-4 rounded-lg">Retour</button>
            {/* Create Menu Section */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-4xl mb-8">
                <h2 className="text-2xl font-bold mb-4 text-purple-300">Créer un Nouveau Menu</h2>
                 <input type="text" placeholder="Nom du nouveau menu" className="w-full p-3 rounded-md bg-gray-700 text-white mb-4" value={newMenuName} onChange={(e) => setNewMenuName(e.target.value)} />
                 <button onClick={createNewMenu} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-3 px-6 rounded-lg">Créer le Menu</button>
            </div>
            {/* My Menus Section */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-4xl mb-8">
                <h2 className="text-2xl font-bold mb-4 text-blue-300">Mes Menus</h2>
                {menus.length === 0 ? <p>Aucun menu créé.</p> :
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{menus.map(menu => (
                        <div key={menu.id} className="bg-gray-700 p-4 rounded-lg">
                            <h3 className="text-xl font-semibold text-blue-200">{menu.name}</h3>
                            <p className="font-mono text-yellow-300">{menu.code}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                 <button onClick={() => setPage('menuCreator', { menuId: menu.id })} className="bg-blue-600 text-xs py-2 px-3 rounded-lg">Gérer</button>
                                 <button onClick={() => setSelectedMenu(menu)} className="bg-green-600 text-xs py-2 px-3 rounded-lg">Commandes</button>
                                 {/* <button onClick={() => handleShareBySms(menu.code)} className="bg-purple-600 text-xs py-2 px-3 rounded-lg">Partager</button> */}
                                 <button onClick={() => handleDeleteMenu(menu)} className="bg-red-600 text-xs py-2 px-3 rounded-lg">Supprimer</button>
                            </div>
                        </div>
                    ))}</div>
                }
            </div>
             {/* Orders Section */}
             {selectedMenu && (
                <div className="bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-4xl">
                     <h2 className="text-2xl font-bold mb-4 text-green-300">Commandes pour "{selectedMenu.name}"</h2>
                     {orders.length === 0 ? <p>Aucune commande.</p> : 
                        <div className="space-y-4 max-h-96 overflow-y-auto">{orders.map(order => (
                             <div key={order.id} className="bg-gray-700 p-4 rounded-lg">
                                <p className="font-semibold text-green-200">De: {order.orderedBy}</p>
                                <ul>{order.items.map((item, i) => <li key={i}>{item.name} (x{item.quantity})</li>)}</ul>
                                <p className="font-bold text-yellow-300 mt-2">Total: {calculateOrderTotal(order.items).toFixed(2)} €</p>
                             </div>
                        ))}</div>
                     }
                </div>
             )}
        </div>
    );
}

function MenuCreator({ setPage, menuId }) { /* ... same logic as before ... */ 
    if (!menuId) return <p>ID de menu manquant</p>;
    return <div>Créateur de Menu pour {menuId}</div>
}
function FamilyOrderPage({ setPage, menuCodeForFamily }) { /* ... same logic as before ... */
     if (!menuCodeForFamily) return <p>Code de menu manquant</p>;
     return <div>Page de commande pour {menuCodeForFamily}</div>
}

export default function App() {
    const [page, setPage] = useState('home');
    const [currentMenuId, setCurrentMenuId] = useState(null);
    const [currentMenuCodeForFamily, setCurrentMenuCodeForFamily] = useState(null);

    useEffect(() => {
        const handleHashChange = () => {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            setPage(hashParams.get('page') || 'home');
            setCurrentMenuId(hashParams.get('menuId') || null);
            setCurrentMenuCodeForFamily(hashParams.get('code') || null);
        };
        window.addEventListener('hashchange', handleHashChange, false);
        handleHashChange();
        return () => window.removeEventListener('hashchange', handleHashChange, false);
    }, []);

    const handleSetPage = (newPage, params = {}) => {
        let newHash = `page=${newPage}`;
        if (params.menuId) newHash += `&menuId=${params.menuId}`;
        if (params.menuCode) newHash += `&code=${params.menuCode}`;
        window.location.hash = newHash;
    };

    const renderPage = () => {
        switch (page) {
            case 'home': return <HomePage setPage={handleSetPage} />;
            case 'chefDashboard': return <ChefDashboard setPage={handleSetPage} />;
            case 'menuCreator': return <MenuCreator setPage={handleSetPage} menuId={currentMenuId} />;
            case 'familyOrder': return <FamilyOrderPage setPage={handleSetPage} menuCodeForFamily={currentMenuCodeForFamily} />;
            default: return <HomePage setPage={handleSetPage} />;
        }
    };

    return <FirebaseProvider>{renderPage()}</FirebaseProvider>;
}

