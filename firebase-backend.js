// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import { getDatabase, ref, get, set, child, update, remove, push, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

console.log("[Firebase Mocker] Initialized Firebase App.");

// --- LIVE IN-MEMORY REPLICAS ---
let memStudents = {};
let memHistory = {};
let memClasses = {};
let memAdmins = {};
let memSettings = {};

let backendReady = false;

function fireMockSocket() {
    if (backendReady) {
        window.dispatchEvent(new Event('socket_data_changed'));
    }
}

const readyPromise = Promise.all([
    new Promise(resolve => onValue(ref(db, 'students'), snap => { memStudents = snap.val() || {}; resolve(); fireMockSocket(); })),
    new Promise(resolve => onValue(ref(db, 'history'), snap => { memHistory = snap.val() || {}; resolve(); fireMockSocket(); })),
    new Promise(resolve => onValue(ref(db, 'classes'), snap => { memClasses = snap.val() || {}; resolve(); fireMockSocket(); })),
    new Promise(resolve => onValue(ref(db, 'admins'), snap => { memAdmins = snap.val() || {}; resolve(); fireMockSocket(); })),
    new Promise(resolve => onValue(ref(db, 'settings'), snap => { memSettings = snap.val() || {}; resolve(); fireMockSocket(); }))
]).then(() => { 
    backendReady = true; 
    console.log("[Firebase Mocker] Memory Replicas synchronized."); 
    window.dispatchEvent(new Event('socket_data_changed')); // Fire once when all ready
});

async function waitForSync() {
    if (!backendReady) await readyPromise;
}

window.io = function() {
    const listeners = {};
    window.addEventListener('socket_data_changed', () => {
        if (listeners['data_changed']) listeners['data_changed']();
    });
    return {
        on: (event, callback) => {
            listeners[event] = callback;
            if (event === 'data_changed') {
                const triggerRef = ref(db, 'system_triggers/data_changed');
                onValue(triggerRef, () => { callback(); });
            }
        },
        emit: () => {}
    };
};

function triggerDataChanged() {
    set(ref(db, 'system_triggers/data_changed'), Date.now()); // fire and forget
}

// Ensure default admin
async function verifyDefaultAdmin() {
    await waitForSync();
    if (!memAdmins['ADMIN']) {
        set(ref(db, 'admins/ADMIN'), { username: 'ADMIN', password: 'tranhuyhoang', role: 'admin0' });
    }
}
verifyDefaultAdmin();

const originalFetch = window.fetch;

function createJsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function createTextResponse(text, status = 200) {
    return new Response(text, { status, headers: { 'Content-Type': 'text/plain' } });
}

window.fetch = async function(resource, config) {
    const url = typeof resource === 'string' ? resource : resource.url;
    const method = config?.method || 'GET';
    const bodyArgs = config?.body ? JSON.parse(config.body) : {};

    if (!url.includes('/api/')) return originalFetch(resource, config);

    try {
        await waitForSync();
        console.log(`[Firebase Mocker] Intercepted ${method} ${url}`, bodyArgs);

        // --- AUTHENTICATION ---
        if (url.includes('/api/login') && method === 'POST') {
            const { username, password } = bodyArgs;
            if (!username) return createJsonResponse({ error: "Thiếu username" }, 401);
            
            const user = memAdmins[username];
            if (user && user.password === password) {
                if (user.role !== 'admin0') {
                    const today = new Date().toISOString().split('T')[0];
                    const expiry = memSettings.expiry_date;
                    const isExpired = expiry && today > expiry;
                    
                    const permsStr = memSettings.permissions || '{"admin1":true,"admin2":true,"admin3":true,"admin4":true}';
                    const perms = JSON.parse(permsStr);
                    const isRoleBlocked = perms[user.role] === false;

                    if (isExpired || isRoleBlocked) {
                        return createJsonResponse({ error: isRoleBlocked ? "Khóa" : "Hết hạn" }, 403);
                    }
                }
                return createJsonResponse({ message: "Login success", token: "mock", role: user.role, username: user.username }, 200);
            }
            return createJsonResponse({ error: "Sai tài khoản hoặc mật khẩu!" }, 401);
        }

        // --- CLASSES ---
        if (url.includes('/api/classes')) {
            if (method === 'GET') {
                const classArray = Object.keys(memClasses).map(k => ({ name: k }));
                return createJsonResponse(classArray.sort((a,b) => a.name.localeCompare(b.name)));
            }
            if (method === 'POST') {
                set(ref(db, `classes/${bodyArgs.name}`), { name: bodyArgs.name });
                return createJsonResponse({ message: "Class created" }, 201);
            }
            if (method === 'DELETE') {
                const match = url.match(/\/api\/classes\/(.+)/);
                if (match) { remove(ref(db, `classes/${match[1]}`)); return createJsonResponse({ message: "Deleted" }); }
            }
        }

        // --- ADMINS ---
        if (url.includes('/api/admins')) {
            if (method === 'GET') return createJsonResponse(Object.values(memAdmins));
            if (method === 'POST') {
                const { username, password, role } = bodyArgs;
                set(ref(db, `admins/${username}`), { username, password, role });
                return createJsonResponse({ message: "Created" }, 201);
            }
            if (method === 'DELETE') {
                const match = url.match(/\/api\/admins\/(.+)/);
                if (match) { remove(ref(db, `admins/${match[1]}`)); return createJsonResponse({ message: "Deleted" }); }
            }
        }

        // --- SETTINGS ---
        if (url.includes('/api/settings')) {
            if (method === 'GET') return createJsonResponse(memSettings);
            const match = url.match(/\/api\/settings\/(.+)/);
            if (!match) return createJsonResponse({error:"Not Found"}, 404);
            const param = match[1];

            if (url.includes('default_stars') && method === 'PUT') {
                set(ref(db, `settings/default_stars`), bodyArgs.default_stars.toString());
                return createJsonResponse({ message: "Updated" });
            }
            if (method === 'PUT') {
                let val = bodyArgs[param];
                if (typeof val === 'object') val = JSON.stringify(val);
                set(ref(db, `settings/${param}`), val);
                return createJsonResponse({ message: "Updated" });
            }
            if (method === 'POST') {
                let current = {};
                try { current = JSON.parse(memSettings[param] || '{}'); } catch(e){}
                current[Date.now().toString()] = { name: bodyArgs.name, points: bodyArgs.points };
                set(ref(db, `settings/${param}`), JSON.stringify(current));
                return createJsonResponse({ message: "Added" }, 201);
            }
            if (method === 'DELETE') {
                const delMatch = url.match(/\/api\/settings\/([^\/]+)\/([^\/]+)/);
                if (delMatch) {
                    const type = delMatch[1], id = delMatch[2];
                    let current = {};
                    try { current = JSON.parse(memSettings[type] || '{}'); } catch(e){}
                    if (current[id]) {
                        delete current[id];
                        set(ref(db, `settings/${type}`), JSON.stringify(current));
                        return createJsonResponse({ message: "Deleted" });
                    }
                }
            }
        }

        // --- HISTORY ---
        if (url.includes('/api/history') || url.includes('/api/history/reset_all')) {
            if (url.includes('/reset_all') && method === 'POST') {
                remove(ref(db, 'history'));
                const defStars = bodyArgs.default_stars || 0;
                const updates = {};
                for (const studentId in memStudents) {
                    updates[`students/${studentId}/stars`] = defStars;
                }
                update(ref(db), updates);
                triggerDataChanged();
                return createJsonResponse({ message: "Reset" });
            }
            if (method === 'GET') {
                const results = Object.keys(memHistory).map(hId => {
                    const h = memHistory[hId];
                    h.id = hId;
                    const student = memStudents[h.student_id];
                    if (student) {
                        h.student_name = student.name;
                        h.class_name = student.class_name;
                    }
                    return h;
                });
                results.sort((a,b) => b.timestamp - a.timestamp);
                
                // Keep local cache up to date for the frontend scripts using it
                try {
                    localStorage.setItem('fb_mock_history_version', memSettings['data_changed'] || 0); // fallback sync
                    localStorage.setItem('fb_mock_history_data', JSON.stringify(results));
                } catch(e) {}
                
                return createJsonResponse(results);
            }
            if (method === 'POST') {
                const newRef = push(ref(db, 'history'));
                set(newRef, { ...bodyArgs, timestamp: Date.now() });
                
                const currentStars = (memStudents[bodyArgs.student_id]?.stars || 0);
                set(ref(db, `students/${bodyArgs.student_id}/stars`), currentStars + bodyArgs.points_change);
                triggerDataChanged();
                return createJsonResponse({ message: "Added" }, 201);
            }
            if (method === 'DELETE') {
                const match = url.match(/\/api\/history\/(.+)/);
                if (match) {
                    const hData = memHistory[match[1]];
                    if (hData) {
                        const currentStars = (memStudents[hData.student_id]?.stars || 0);
                        set(ref(db, `students/${hData.student_id}/stars`), currentStars - hData.points_change);
                        remove(ref(db, `history/${match[1]}`));
                        triggerDataChanged();
                    }
                    return createJsonResponse({ message: "Deleted" });
                }
            }
        }

        // --- RECALCULATE ALL STUDENTS ---
        if (url.includes('/api/students/recalculate_all') && method === 'POST') {
            const defStars = bodyArgs.default_stars || 0;
            const updates = {};
            for(const studentId in memStudents) updates[`students/${studentId}/stars`] = defStars;
            
            for(const hId in memHistory) {
                const h = memHistory[hId];
                if (updates[`students/${h.student_id}/stars`] !== undefined) {
                    updates[`students/${h.student_id}/stars`] += h.points_change;
                }
            }
            if (Object.keys(updates).length > 0) update(ref(db), updates);
            triggerDataChanged();
            return createJsonResponse({ message: "Recalculated" });
        }

        if (url.includes('/api/students/clean_photos') && method === 'POST') {
             remove(ref(db, 'photos'));
             return createJsonResponse({ message: "Cleaned" });
        }

        if (url.includes('/photo') && method === 'GET') {
             const match = url.match(/\/api\/students\/(.+)\/photo/);
             if (match) {
                 const id = match[1];
                 const snap = await get(ref(db, `photos/${id}`)); // Photos are large, keep them lazy loaded
                 const photoStr = snap.val();
                 if (photoStr) return createTextResponse(photoStr);
                 return createTextResponse("", 404);
             }
        }

        // --- STUDENTS CORE ---
        if (url.includes('/api/students')) {
            if (method === 'GET') {
                const match = url.match(/\/api\/students\/([^\/]+)$/);
                if (match) {
                    const s = memStudents[match[1]];
                    if (s) return createJsonResponse(s);
                    return createJsonResponse({ error: "Not found" }, 404);
                }

                const studentsArray = Object.values(memStudents).map(s => {
                    const { photo, ...rest } = s; 
                    return rest;
                });
                
                studentsArray.sort((a,b) => {
                    if (b.stars !== a.stars) return b.stars - a.stars;
                    return a.name.localeCompare(b.name);
                });

                try {
                    localStorage.setItem('fb_mock_students_data', JSON.stringify(studentsArray));
                } catch(e) {}

                return createJsonResponse(studentsArray);
            }
            
            if (method === 'POST') {
                const { id, name, class_name, photo, stars, is_update } = bodyArgs;
                if (!id || !name) return createJsonResponse({ error: "Thiếu MSHS hoặc Họ tên!" }, 400);

                if (!is_update && memStudents[id]) {
                     return createJsonResponse({ error: "Trùng MSHS! Mã số học sinh này đã tồn tại trên hệ thống. Vui lòng nhập ID khác!" }, 400);
                }

                const existingStars = memStudents[id]?.stars || 0;
                const payload = { id, name, class_name, stars: (stars !== undefined && stars !== null) ? stars : existingStars };
                
                if (photo) set(ref(db, `photos/${id}`), photo);
                set(ref(db, `students/${id}`), payload);
                triggerDataChanged();
                return createJsonResponse({ message: "Lưu dữ liệu học sinh thành công" });
            }

            if (method === 'DELETE') {
                 const match = url.match(/\/api\/students\/([^\/]+)$/);
                 if (match) {
                     const qId = match[1];
                     remove(ref(db, `students/${qId}`));
                     remove(ref(db, `photos/${qId}`));
                     return createJsonResponse({ message: "Student deleted" });
                 }
            }
        }

    } catch (e) {
        console.error("[Firebase Mocker] Error resolving request: ", e);
        return createJsonResponse({ error: "Internal Firebase Mock Error" }, 500);
    }
    
    return originalFetch(resource, config);
};

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
               if (node.tagName === 'IMG' && node.src && node.src.includes('/api/students/')) {
                   hijackImgSrc(node);
               } 
               if (node.querySelectorAll) {
                   node.querySelectorAll('img[src*="/api/students/"]').forEach(hijackImgSrc);
               }
            });
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
             if (mutation.target.tagName === 'IMG' && mutation.target.src && mutation.target.src.includes('/api/students/')) {
                 hijackImgSrc(mutation.target);
             }
        }
    });
});

async function hijackImgSrc(imgNode) {
    if (imgNode._isHijacked) return;
    const url = imgNode.getAttribute('src');
    const idMatch = url.match(/\/api\/students\/(.+)\/photo/);
    if (!idMatch) return;
    imgNode._isHijacked = true;
    
    // We fetch photo lazily as it's big
    try {
        const snap = await get(ref(db, `photos/${idMatch[1]}`));
        const photoB64 = snap.val();
        imgNode.src = photoB64 || '/logo.png';
    } catch { imgNode.src = '/logo.png'; }
}

observer.observe(document.body || document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['src']
});
document.querySelectorAll('img[src*="/api/students/"]').forEach(hijackImgSrc);
console.log("[Firebase Mocker] API Call interceptions active.");

window.firebaseBackendReady = true;
window.dispatchEvent(new Event('firebaseBackendReady'));
