// ----- FIREBASE CONFIGURATION -----
const firebaseConfig = {
  apiKey: "AIzaSyBcnbOXvlC4Z30Y34BMShr8NaGozymIVLE",
  authDomain: "fairytopia.firebaseapp.com",
  databaseURL: "https://fairytopia-default-rtdb.firebaseio.com",
  projectId: "fairytopia",
  storageBucket: "fairytopia.firebasestorage.app",
  messagingSenderId: "531666119490",
  appId: "1:531666119490:web:329cedbdaf92247cdef6db"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- GLOBAL STATE ---
let currentUser = null;
let placedItems = [];
let selectedType = 'fairy';
let draggingItem = null;
let dragOffset = { x: 0, y: 0 };

const EMOJI_MAP = {
    'fairy': '🧚',
    'mushroom': '🍄',
    'crystal': '💎',
    'flower': '🌸',
    'star': '⭐',
    'wand': '🪄'
};

// --- AUTH LOGIC ---
onAuthStateChanged(auth, (user) => {
    const authOverlay = document.getElementById('auth-overlay');
    if (user) {
        currentUser = user;
        authOverlay.style.opacity = '0';
        setTimeout(() => authOverlay.classList.add('hidden'), 500);
        document.getElementById('user-info').classList.remove('hidden');
        document.getElementById('user-display').innerText = `Fairy: ${user.email.split('@')[0]}`;
        loadGallery();
    } else {
        currentUser = null;
        authOverlay.classList.remove('hidden');
        authOverlay.style.opacity = '1';
        document.getElementById('user-info').classList.add('hidden');
    }
});

// Expose logout
window.logout = () => signOut(auth);

document.getElementById('login-btn').onclick = () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    if (!email || !pass) return alert("Enter your magic words!");
    signInWithEmailAndPassword(auth, email, pass).catch(() => {
        createUserWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
    });
};

// --- p5.js INSTANCE MODE ---
const sketch = (s) => {
    s.setup = () => {
        const container = document.getElementById('canvas-container');
        const canvas = s.createCanvas(container.offsetWidth, 500);
        canvas.parent('canvas-container');
        
        // Handle window resizing
        window.addEventListener('resize', () => {
            s.resizeCanvas(container.offsetWidth, 500);
        });

        // UI Listeners
        document.querySelectorAll('.item-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.item-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedType = btn.dataset.type;
            };
        });

        document.getElementById('save-btn').onclick = saveScene;
        document.getElementById('clear-btn').onclick = () => { placedItems = []; };
        
        // Default initial button
        document.querySelector('[data-type="fairy"]').classList.add('active');
    };

    s.draw = () => {
        s.background(20, 0, 40);
        
        // Ground
        s.fill(40, 20, 60);
        s.noStroke();
        s.rect(0, s.height - 100, s.width, 100);

        // Rendering Items
        s.textAlign(s.CENTER, s.CENTER);
        s.textSize(50);
        placedItems.forEach(item => {
            if (isMouseOver(item, s)) {
                s.drawingContext.shadowBlur = 20;
                s.drawingContext.shadowColor = '#00ffff';
            }
            s.text(item.emoji, item.x, item.y);
            s.drawingContext.shadowBlur = 0;
        });
    };

    s.mousePressed = () => {
        // Only ignore if clicking on side panels (though canvas should handle its own clicks)
        if (s.mouseX < 0 || s.mouseX > s.width || s.mouseY < 0 || s.mouseY > s.height) return;

        // Check for dragging
        for (let i = placedItems.length - 1; i >= 0; i--) {
            if (isMouseOver(placedItems[i], s)) {
                draggingItem = placedItems[i];
                dragOffset.x = draggingItem.x - s.mouseX;
                dragOffset.y = draggingItem.y - s.mouseY;
                return;
            }
        }

        // Place new item
        placedItems.push({
            x: s.mouseX,
            y: s.mouseY,
            type: selectedType,
            emoji: EMOJI_MAP[selectedType]
        });
    };

    s.mouseDragged = () => {
        if (draggingItem) {
            draggingItem.x = s.mouseX + dragOffset.x;
            draggingItem.y = s.mouseY + dragOffset.y;
        }
    };

    s.mouseReleased = () => {
        draggingItem = null;
    };

    s.keyPressed = () => {
        if (s.keyCode === s.DELETE || s.keyCode === s.BACKSPACE) {
            for (let i = placedItems.length - 1; i >= 0; i--) {
                if (isMouseOver(placedItems[i], s)) {
                    placedItems.splice(i, 1);
                    break;
                }
            }
        }
    };
};

function isMouseOver(item, s) {
    return s.dist(s.mouseX, s.mouseY, item.x, item.y) < 30;
}

new p5(sketch);

// --- CLOUD LOGIC ---
async function saveScene() {
    if (!currentUser) return alert("Must be logged in to save magic!");
    const desc = document.getElementById('scene-description').value;
    const sceneData = {
        user: currentUser.email.split('@')[0],
        description: desc || "A mystical scene",
        items: placedItems,
        timestamp: Date.now()
    };

    try {
        const scenesRef = ref(db, 'dollhouse_scenes');
        const newSceneRef = push(scenesRef);
        await set(newSceneRef, sceneData);
        alert("✨ Scene saved! ✨");
    } catch (e) {
        alert("The magic failed!");
    }
}

function loadGallery() {
    const gallery = document.getElementById('scene-gallery');
    const scenesRef = ref(db, 'dollhouse_scenes');
    onValue(scenesRef, (snapshot) => {
        const data = snapshot.val();
        gallery.innerHTML = "";
        if (!data) return gallery.innerHTML = "<p>No scenes yet.</p>";
        Object.values(data).reverse().forEach(scene => {
            const card = document.createElement('div');
            card.className = "scene-card";
            card.innerHTML = `
                <h3>${scene.user}'s Realm</h3>
                <p>${scene.description}</p>
                <div style="font-size: 1.5rem; margin-top: 10px;">
                    ${scene.items.slice(0, 5).map(i => i.emoji).join(' ')}
                </div>
            `;
            card.onclick = () => { placedItems = JSON.parse(JSON.stringify(scene.items)); };
            gallery.appendChild(card);
        });
    });
}
