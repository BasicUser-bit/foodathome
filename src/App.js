import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

// Ces variables globales seront normalement fournies par votre environnement d'hébergement.
// Pour des tests locaux ou un déploiement simple, vous pourriez avoir à les gérer différemment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Analyser la configuration de Firebase en toute sécurité
const firebaseConfig = (() => {
    try {
        return JSON.parse(firebaseConfigStr);
    } catch (e) {
        console.error("Erreur lors de l'analyse de la configuration Firebase:", e);
        return {}; // Retourner un objet vide en cas d'erreur
    }
})();

// Créer un contexte pour Firebase et l'Authentification
const FirebaseContext = createContext(null);

// Hook personnalisé pour un état persistant avec localStorage
function usePersistentState(key, initialValue) {
    const [state, setState] = useState(() => {
        let valueToReturn = typeof initialValue === 'function' ? initialValue() : initialValue;
        try {
            const storedValue = localStorage.getItem(key);
            if (storedValue !== null && storedValue !== undefined && storedValue !== "") {
                valueToReturn = JSON.parse(storedValue);
            }
        } catch (error) {
            console.error(`Erreur de lecture de localStorage pour la clé "${key}". Utilisation de la valeur initiale.`, error);
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

// Fournisseur de contexte Firebase
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

// Composant Modal
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

// Composant HomePage
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
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

// Fonction utilitaire pour publier un menu
async function publishMenu(db, menuData, chefId, menuIdOriginal) {
    if (!db || !menuData || !menuData.code || !chefId || !menuIdOriginal) {
        console.error("publishMenu: Données manquantes pour la publication");
        return;
    }
    try {
        const publishedMenuRef = doc(db, `artifacts/${appId}/public/data/published_menus`, menuData.code);
        const menuToPublish = {
            name: menuData.name,
            code: menuData.code,
            items: menuData.items || [],
            categories: menuData.categories || [],
            chefId: chefId,
            menuId_original: menuIdOriginal,
            updatedAt: new Date(),
        };
        await setDoc(publishedMenuRef, menuToPublish);
        console.log(`Menu ${menuData.code} publié avec succès.`);
    } catch (error) {
        console.error("Erreur de publication du menu:", error);
    }
}

// Composant ChefDashboard
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

    // États pour les suggestions Gemini
    const [showSuggestNameModal, setShowSuggestNameModal] = useState(false);
    const [menuThemeInput, setMenuThemeInput] = usePersistentState('chefDashboard_menuThemeInput_foodathome', '');
    const [suggestedMenuNames, setSuggestedMenuNames] = useState([]);
    const [isGeneratingMenuNames, setIsGeneratingMenuNames] = useState(false);
    const [showSuggestDishesModal, setShowSuggestDishesModal] = useState(false);
    const [menuForDishSuggestion, setMenuForDishSuggestion] = useState(null);
    const [suggestedDishes, setSuggestedDishes] = useState([]);
    const [isGeneratingDishes, setIsGeneratingDishes] = useState(false);

    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const menusCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/menus`);
        const unsubscribe = onSnapshot(menusCollectionRef, snapshot => {
            const fetchedMenus = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMenus(fetchedMenus);
            if (selectedMenu && !fetchedMenus.find(m => m.id === selectedMenu.id)) {
                setSelectedMenu(null);
            }
        }, err => console.error("Erreur lecture menus:", err));
        return unsubscribe;
    }, [db, userId, isAuthReady, selectedMenu, setSelectedMenu]);

    useEffect(() => {
        if (!db || !selectedMenu?.code) {
            setOrders([]);
            return;
        }
        const q = query(collection(db, `artifacts/${appId}/public/data/orders`), where("menuCode", "==", selectedMenu.code));
        const unsubscribe = onSnapshot(q, snapshot => {
            setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, err => console.error("Erreur lecture commandes:", err));
        return unsubscribe;
    }, [db, selectedMenu]);

    const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

    const createNewMenu = async () => {
        if (!db || !userId) return;
        if (newMenuName.trim() === '') { setModalMessage("Veuillez nommer votre menu."); return; }
        const menuCode = generateCode();
        const menuIdOriginal = doc(collection(db, `artifacts/${appId}/users/${userId}/menus`)).id;
        const privateMenuData = {
            name: newMenuName, code: menuCode, items: [], 
            categories: [{ id: 'cat-' + generateCode(), name: 'Boissons' }], 
            createdAt: new Date(), chefId: userId,
        };
        try {
            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/menus`, menuIdOriginal), privateMenuData);
            await publishMenu(db, privateMenuData, userId, menuIdOriginal);
            setNewMenuName('');
            setModalMessage(`Menu "${newMenuName}" créé (Code: ${menuCode}).`);
        } catch (e) { console.error("Erreur création menu:", e); }
    };

    const handleDeleteMenu = (menu) => { setMenuToDelete(menu); setShowConfirmModal(true); };
    const confirmDeleteMenu = async () => {
        if (!db || !userId || !menuToDelete) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/menus`, menuToDelete.id));
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/published_menus`, menuToDelete.code));
            const ordersQuery = query(collection(db, `artifacts/${appId}/public/data/orders`), where("menuCode", "==", menuToDelete.code));
            const orderDocs = await getDocs(ordersQuery);
            orderDocs.forEach(d => deleteDoc(d.ref));
            if (selectedMenu?.code === menuToDelete.code) setSelectedMenu(null);
        } catch (e) { console.error("Erreur suppression menu:", e); } 
        finally { setShowConfirmModal(false); setMenuToDelete(null); }
    };
    
    // Reste de ChefDashboard (fonctions Gemini, JSX)
    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-4">
            <h1 className="text-4xl font-bold mb-8 text-purple-400">Tableau de Bord du Chef</h1>
            {/* Le JSX complet pour ChefDashboard irait ici... */}
            <p>Contenu du tableau de bord du chef...</p>
             <button onClick={() => setPage('home')} className="absolute top-4 left-4 bg-gray-700 hover:bg-gray-600 py-2 px-4 rounded-lg transition">Retour</button>
        </div>
    );
}

// Composant MenuCreator
function MenuCreator({ setPage, menuId }) {
    const { db, userId, isAuthReady } = useFirebase();
    const [menu, setMenu] = useState(null);

    useEffect(() => {
        if (!isAuthReady || !db || !userId || !menuId) return;
        const menuDocRef = doc(db, `artifacts/${appId}/users/${userId}/menus`, menuId);
        const unsubscribe = onSnapshot(menuDocRef, docSnap => {
            if (docSnap.exists()) {
                setMenu({ id: docSnap.id, ...docSnap.data() });
            } else {
                setPage('chefDashboard');
            }
        });
        return unsubscribe;
    }, [db, userId, isAuthReady, menuId, setPage]);

    const updateAndRepublish = async (updates) => {
        if (!db || !userId || !menu) return;
        const menuDocRef = doc(db, `artifacts/${appId}/users/${userId}/menus`, menu.id);
        try {
            await updateDoc(menuDocRef, updates);
            const updatedDoc = await getDoc(menuDocRef);
            if (updatedDoc.exists()) {
                await publishMenu(db, { id: updatedDoc.id, ...updatedDoc.data() }, userId, menu.id);
            }
        } catch (e) { console.error("Erreur mise à jour menu:", e); }
    };
    
    // Reste de MenuCreator (logique d'ajout/modif/suppression d'items/catégories)
    if (!menu) return <div className="text-white">Chargement...</div>;

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-4">
            <h1 className="text-4xl font-bold mb-2 text-blue-400">Gérer: {menu.name}</h1>
            <p className="text-lg text-gray-300 mb-6">Code: <span className="font-mono text-yellow-300">{menu.code}</span></p>
            {/* Le JSX complet pour MenuCreator irait ici... */}
            <button onClick={() => setPage('chefDashboard')} className="absolute top-4 left-4 bg-gray-700 hover:bg-gray-600 py-2 px-4 rounded-lg transition">Retour</button>
        </div>
    );
}

// Composant FamilyOrderPage
function FamilyOrderPage({ setPage, menuCodeForFamily }) {
    const { db, isAuthReady } = useFirebase();
    const [menu, setMenu] = useState(null);
    const [modalMessage, setModalMessage] = useState('');
    
    useEffect(() => {
        if (!isAuthReady || !db || !menuCodeForFamily) return;
        const fetchMenu = async () => {
            try {
                const publishedMenuRef = doc(db, `artifacts/${appId}/public/data/published_menus`, menuCodeForFamily);
                const menuSnap = await getDoc(publishedMenuRef);
                if (menuSnap.exists()) {
                    setMenu({ id: menuSnap.id, ...menuSnap.data() });
                } else {
                    setModalMessage("Menu introuvable. Le code est peut-être incorrect ou le menu a été supprimé.");
                }
            } catch (e) {
                console.error("Erreur lecture menu publié:", e);
                setModalMessage("Erreur technique lors du chargement.");
            }
        };
        fetchMenu();
    }, [db, isAuthReady, appId, menuCodeForFamily]);

    if (!menuCodeForFamily) return <div className="text-white p-4">Aucun code de menu fourni. <button onClick={() => setPage('home')}>Retour</button></div>;
    if (!menu) return <div className="text-white p-4">Chargement du menu (code: {menuCodeForFamily})... <Modal message={modalMessage} onConfirm={() => setPage('home')} /></div>;
    
    // Reste de FamilyOrderPage (logique de commande)
    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-4">
            <h1 className="text-4xl font-bold mb-2 text-green-400">Menu: {menu.name}</h1>
            {/* Le JSX complet pour FamilyOrderPage irait ici... */}
             <button onClick={() => setPage('home')} className="absolute top-4 left-4 bg-gray-700 hover:bg-gray-600 py-2 px-4 rounded-lg transition">Retour</button>
        </div>
    );
}

// Composant principal App
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
