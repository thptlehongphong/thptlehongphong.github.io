// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import { getDatabase, ref, get, set, child, update, remove, push, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Your web app's Firebase configuration
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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

console.log("[Firebase Mocker] Initialized Firebase App.");

// Global state mechanism to spoof socket.io "io()"
window.io = function() {
    console.log("[Firebase Mocker] Spoofed io() called");
    return {
        on: (event, callback) => {
            if (event === 'data_changed') {
                const triggerRef = ref(db, 'system_triggers/data_changed');
                onValue(triggerRef, (snapshot) => {
                    callback();
                });
            }
        },
        emit: (event, data) => {}
    };
};

function triggerDataChanged() {
    const triggerRef = ref(db, 'system_triggers/data_changed');
    set(triggerRef, Date.now());
}

// Ensure at least default ADMIN exists
async function verifyDefaultAdmin() {
    const adminRef = ref(db, 'admins/ADMIN');
    const snapshot = await get(adminRef);
    if (!snapshot.exists()) {
        console.log("[Firebase Mocker] Creating default ADMIN");
        await set(adminRef, {
            username: 'ADMIN',
            password: 'tranhuyhoang',
            role: 'admin0'
        });
    }
}
verifyDefaultAdmin();

const originalFetch = window.fetch;

// Helper to construct spoofed Response
function createJsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function createTextResponse(text, status = 200) {
    return new Response(text, {
        status: status,
        headers: { 'Content-Type': 'text/plain' }
    });
}

window.fetch = async function(resource, config) {
    const url = typeof resource === 'string' ? resource : resource.url;
    const method = config?.method || 'GET';
    const bodyArgs = config?.body ? JSON.parse(config.body) : {};

    // Ignore non-api calls
    if (!url.includes('/api/')) {
        return originalFetch(resource, config);
    }

    try {
        console.log(`[Firebase Mocker] Intercepted ${method} ${url}`, bodyArgs);

        // --- AUTHENTICATION ---
        if (url.includes('/api/login') && method === 'POST') {
            const { username, password } = bodyArgs;
            if (!username) return createJsonResponse({ error: "Thiếu username" }, 401);

            const adminRef = ref(db, `admins/${username}`);
            const snapshot = await get(adminRef);
            
            if (snapshot.exists()) {
                const user = snapshot.val();
                if (user.password === password) {
                    // Check status validity for non-admin0
                    if (user.role !== 'admin0') {
                        const settingsRef = ref(db, 'settings');
                        const settingsSnap = await get(settingsRef);
                        const settings = settingsSnap.val() || {};
                        
                        const today = new Date().toISOString().split('T')[0];
                        const expiry = settings.expiry_date;
                        const isExpired = expiry && today > expiry;
                        
                        const permsStr = settings.permissions || '{"admin1":true,"admin2":true,"admin3":true,"admin4":true}';
                        const perms = JSON.parse(permsStr);
                        const isRoleBlocked = perms[user.role] === false;

                        if (isExpired || isRoleBlocked) {
                            let errorMsg = isRoleBlocked ? "Tài khoản của bạn đã bị tạm khóa quyền truy cập!" : "Hệ thống đã hết hạn sử dụng. Vui lòng gia hạn!";
                            return createJsonResponse({ error: errorMsg }, 403);
                        }
                    }

                    return createJsonResponse({ 
                        message: "Login successful", 
                        token: "firebase-mock-token", 
                        role: user.role,
                        username: user.username 
                    }, 200);
                }
            }
            return createJsonResponse({ error: "Sai tài khoản hoặc mật khẩu!" }, 401);
        }

        // --- CLASSES ---
        if (url.includes('/api/classes')) {
            const classesRef = ref(db, 'classes');
            if (method === 'GET') {
                const snap = await get(classesRef);
                const classes = snap.val() || {};
                const classArray = Object.keys(classes).map(k => ({ name: k }));
                return createJsonResponse(classArray.sort((a,b) => a.name.localeCompare(b.name)));
            }
            if (method === 'POST') {
                const { name } = bodyArgs;
                await set(ref(db, `classes/${name}`), { name });
                return createJsonResponse({ message: "Class created" }, 201);
            }
            if (method === 'DELETE') {
                const nameMatch = url.match(/\/api\/classes\/(.+)/);
                if (nameMatch) {
                    await remove(ref(db, `classes/${nameMatch[1]}`));
                    return createJsonResponse({ message: "Class deleted" });
                }
            }
        }

        // --- ADMINS ---
        if (url.includes('/api/admins')) {
            const adminsRef = ref(db, 'admins');
            if (method === 'GET') {
                const snap = await get(adminsRef);
                const admins = snap.val() || {};
                const adminArray = Object.values(admins);
                return createJsonResponse(adminArray);
            }
            if (method === 'POST') {
                const { username, password, role } = bodyArgs;
                await set(ref(db, `admins/${username}`), { username, password, role });
                return createJsonResponse({ message: "Admin created" }, 201);
            }
            if (method === 'DELETE') {
                const usernameMatch = url.match(/\/api\/admins\/(.+)/);
                if (usernameMatch) {
                    await remove(ref(db, `admins/${usernameMatch[1]}`));
                    return createJsonResponse({ message: "Admin deleted" });
                }
            }
        }

        // --- SETTINGS ---
        if (url.includes('/api/settings')) {
            if (method === 'GET') {
                const snap = await get(ref(db, 'settings'));
                return createJsonResponse(snap.val() || {});
            }

            const paramMatch = url.match(/\/api\/settings\/(.+)/);
            if (!paramMatch) return createJsonResponse({error:"Not Found"}, 404);
            const keyOrType = paramMatch[1]; // :key or :type or default_stars

            if (url.includes('/api/settings/default_stars') && method === 'PUT') {
                 await set(ref(db, `settings/default_stars`), bodyArgs.default_stars.toString());
                 return createJsonResponse({ message: "Setting updated" });
            }

            if (method === 'PUT') {
                let valToSet = bodyArgs[keyOrType];
                if (typeof valToSet === 'object') {
                    valToSet = JSON.stringify(valToSet);
                }
                await set(ref(db, `settings/${keyOrType}`), valToSet);
                return createJsonResponse({ message: "Setting updated" });
            }
            
            if (method === 'POST') {
                 // POST /api/settings/:type (Add to JSON list settings like ViolationTypes)
                // Actually the API path looks like: /api/settings/violationtypes => paramMatch[1] = violationtypes
                const type = keyOrType; 
                const { name, points } = bodyArgs;
                
                const snap = await get(ref(db, `settings/${type}`));
                let currentStr = snap.val();
                let current = {};
                if (currentStr) {
                    try { current = JSON.parse(currentStr); } catch(e){}
                }
                
                const id = Date.now().toString();
                current[id] = { name, points };
                
                await set(ref(db, `settings/${type}`), JSON.stringify(current));
                return createJsonResponse({ message: "Added successfully" }, 201);
            }

            if (method === 'DELETE') {
                // DELETE /api/settings/:type/:id => /api/settings/violationtypes/123123
                const deleteMatch = url.match(/\/api\/settings\/([^\/]+)\/([^\/]+)/);
                if (deleteMatch) {
                    const type = deleteMatch[1];
                    const id = deleteMatch[2];
                    
                    const snap = await get(ref(db, `settings/${type}`));
                    let currentStr = snap.val();
                    let current = {};
                    if (currentStr) {
                        try { current = JSON.parse(currentStr); } catch(e){}
                    }
                    if (current[id]) {
                        delete current[id];
                        await set(ref(db, `settings/${type}`), JSON.stringify(current));
                        return createJsonResponse({ message: "Deleted successfully" });
                    }
                }
            }
        }

        // --- HISTORY ---
        if (url.includes('/api/history') || url.includes('/api/history/reset_all')) {
            if (url.includes('/reset_all') && method === 'POST') {
                const { default_stars } = bodyArgs;
                await remove(ref(db, 'history'));
                
                // Reset student stars
                const snap = await get(ref(db, 'students'));
                const students = snap.val() || {};
                const updates = {};
                for (const studentId in students) {
                    updates[`students/${studentId}/stars`] = default_stars || 0;
                }
                await update(ref(db), updates);
                
                triggerDataChanged();
                return createJsonResponse({ message: "System reset successfully" });
            }

            if (method === 'GET') {
                const triggerSnap = await get(ref(db, 'system_triggers/data_changed'));
                const serverVersion = triggerSnap.val() || 0;
                
                const cachedVersion = localStorage.getItem('fb_mock_history_version');
                const cachedData = localStorage.getItem('fb_mock_history_data');

                if (cachedData && cachedVersion == serverVersion) {
                    console.log("[Firebase Mocker] ⚡ Serving /api/history from Local Cache");
                    return createJsonResponse(JSON.parse(cachedData));
                }

                console.log("[Firebase Mocker] ⏳ Cache Miss. Fetching /api/history from Firebase...");
                const hSnap = await get(ref(db, 'history'));
                const sSnap = await get(ref(db, 'students'));
                const histories = hSnap.val() || {};
                const students = sSnap.val() || {};
                
                const results = Object.keys(histories).map(hId => {
                    const h = histories[hId];
                    h.id = hId;
                    const student = students[h.student_id];
                    if (student) {
                        h.student_name = student.name;
                        h.class_name = student.class_name;
                    }
                    return h;
                });
                
                // Sort by timestamp DESC
                results.sort((a,b) => b.timestamp - a.timestamp);

                try {
                    localStorage.setItem('fb_mock_history_version', serverVersion);
                    localStorage.setItem('fb_mock_history_data', JSON.stringify(results));
                } catch(e) {}

                return createJsonResponse(results);
            }
            if (method === 'POST') {
                const { student_id, type_name, points_change, is_merit, created_by } = bodyArgs;
                
                const newRef = push(ref(db, 'history'));
                await set(newRef, {
                    student_id, type_name, points_change, is_merit, created_by,
                    timestamp: Date.now()
                });

                // Update stars natively
                const stRef = ref(db, `students/${student_id}/stars`);
                const stSnap = await get(stRef);
                const currentStars = stSnap.val() || 0;
                await set(stRef, currentStars + points_change);

                triggerDataChanged();
                return createJsonResponse({ message: "History record added and points updated" }, 201);
            }
            if (method === 'DELETE') {
                // DELETE /api/history/:id
                const idMatch = url.match(/\/api\/history\/(.+)/);
                if (idMatch) {
                    const id = idMatch[1];
                    const hRef = ref(db, `history/${id}`);
                    const hSnap = await get(hRef);
                    
                    if (hSnap.exists()) {
                        const hData = hSnap.val();
                        // Revert points
                        const stRef = ref(db, `students/${hData.student_id}/stars`);
                        const stSnap = await get(stRef);
                        const currentStars = stSnap.val() || 0;
                        await set(stRef, currentStars - hData.points_change);

                        // Delete
                        await remove(hRef);
                        triggerDataChanged();
                    }
                    return createJsonResponse({ message: "Record deleted and stars updated" });
                }
            }
        }

        // --- RECACULATE ALL STUDENTS ---
        if (url.includes('/api/students/recalculate_all') && method === 'POST') {
            const { default_stars } = bodyArgs;
            const defStars = default_stars || 0;
            
            const [sSnap, hSnap] = await Promise.all([
                get(ref(db, 'students')),
                get(ref(db, 'history'))
            ]);
            
            const students = sSnap.val() || {};
            const histories = hSnap.val() || {};
            
            // Reset to default
            for(const studentId in students) {
                students[studentId].stars = defStars;
            }
            
            // Add history points
            for(const hId in histories) {
                const h = histories[hId];
                if (students[h.student_id]) {
                    students[h.student_id].stars += h.points_change;
                }
            }
            
             const updates = {};
             for(const studentId in students) {
                 updates[`students/${studentId}/stars`] = students[studentId].stars;
             }
             if (Object.keys(updates).length > 0) {
                 await update(ref(db), updates);
             }

            triggerDataChanged();
            return createJsonResponse({ message: "Recalculation complete" });
        }


        // --- CLEAN PHOTOS ---
        if (url.includes('/api/students/clean_photos') && method === 'POST') {
             await remove(ref(db, 'photos'));
             return createJsonResponse({ message: "All student photos cleaned" });
        }


        // --- GET STUDENT PHOTO ---
        if (url.includes('/photo') && method === 'GET') {
             // Mock standard fetch API responding with photo
             const idMatch = url.match(/\/api\/students\/(.+)\/photo/);
             if (idMatch) {
                 const id = idMatch[1];
                 const snap = await get(ref(db, `photos/${id}`));
                 const photoStr = snap.val();
                 if (photoStr) {
                     return createTextResponse(photoStr);
                 }
                 return createTextResponse("", 404);
             }
        }

        // --- STUDENTS CORE ---
        if (url.includes('/api/students')) {
            if (method === 'GET') {
                const idMatch = url.match(/\/api\/students\/([^\/]+)$/);
                if (idMatch) {
                    const id = idMatch[1];
                    const snap = await get(ref(db, `students/${id}`));
                    if (snap.exists()) {
                         return createJsonResponse(snap.val());
                    }
                    return createJsonResponse({ error: "Student not found" }, 404);
                }

                // Get All with Caching Mechanism
                const triggerSnap = await get(ref(db, 'system_triggers/data_changed'));
                const serverVersion = triggerSnap.val() || 0;
                
                const cachedVersion = localStorage.getItem('fb_mock_students_version');
                const cachedData = localStorage.getItem('fb_mock_students_data');

                // If cache matches server version, return instantly
                if (cachedData && cachedVersion == serverVersion) {
                    console.log("[Firebase Mocker] ⚡ Serving /api/students from Local Cache");
                    return createJsonResponse(JSON.parse(cachedData));
                }

                // Cache Miss or Outdated -> Fetch heavy payload
                console.log("[Firebase Mocker] ⏳ Cache Miss. Fetching /api/students from Firebase...");
                const snap = await get(ref(db, 'students'));
                const studentsObj = snap.val() || {};
                const studentsArray = Object.values(studentsObj).map(s => {
                    const { photo, ...rest } = s; 
                    return rest;
                });
                
                studentsArray.sort((a,b) => {
                    if (b.stars !== a.stars) return b.stars - a.stars;
                    return a.name.localeCompare(b.name);
                });

                // Update Cache
                try {
                    localStorage.setItem('fb_mock_students_version', serverVersion);
                    localStorage.setItem('fb_mock_students_data', JSON.stringify(studentsArray));
                } catch(e) { console.warn("[Firebase Mocker] Quota Exceeded for LocalStorage caching"); }

                return createJsonResponse(studentsArray);
            }
            
            if (method === 'POST') {
                const { id, name, class_name, photo, stars, is_update } = bodyArgs;
                if (!id || !name) return createJsonResponse({ error: "Thiếu MSHS hoặc Họ tên!" }, 400);

                const studentRef = ref(db, `students/${id}`);
                const snap = await get(studentRef);
                
                if (!is_update && snap.exists()) {
                     return createJsonResponse({ error: "Trùng MSHS! Mã số học sinh này đã tồn tại trên hệ thống. Vui lòng nhập ID khác!" }, 400);
                }

                const existingData = snap.exists() ? snap.val() : {};
                const payload = {
                    id, name, class_name, 
                    stars: (stars !== undefined && stars !== null) ? stars : (existingData.stars || 0)
                };
                
                if (photo) {
                    await set(ref(db, `photos/${id}`), photo);
                }

                await set(studentRef, payload);
                triggerDataChanged();

                return createJsonResponse({ message: "Lưu dữ liệu học sinh thành công" });
            }

            if (method === 'DELETE') {
                 const idMatch = url.match(/\/api\/students\/([^\/]+)$/);
                 if (idMatch) {
                     const qId = idMatch[1];
                     await remove(ref(db, `students/${qId}`));
                     await remove(ref(db, `photos/${qId}`));
                     return createJsonResponse({ message: "Student deleted" });
                 }
            }
        }

    } catch (e) {
        console.error("[Firebase Mocker] Error resolving request: ", e);
        return createJsonResponse({ error: "Internal Firebase Mock Error" }, 500);
    }
    
    // Fallback if not caught by intercepts
    return originalFetch(resource, config);
};


// --- MUTATION OBSERVER TO INTERCEPT IMAGE SRC ATTRIBUTES ---
// Instead of modifying DOM dynamically for images manually, we watch for <img src="/api/students/.../photo">
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
               if (node.tagName === 'IMG' && node.src && node.src.includes('/api/students/')) {
                   hijackImgSrc(node);
               } 
               // For complex trees inserted
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
    if (imgNode._isHijacked) return; // Prevent infinite loop if we change src
    const url = imgNode.getAttribute('src'); // using getAttribute to get relative URLs reliably
    
    // It must exactly match /api/students/.../photo
    const idMatch = url.match(/\/api\/students\/(.+)\/photo/);
    if (!idMatch) return;

    imgNode._isHijacked = true;
    const id = idMatch[1];
    
    const snap = await get(ref(db, `photos/${id}`));
    const photoB64 = snap.val();
    
    if (photoB64) {
        imgNode.src = photoB64;
    } else {
        imgNode.src = '/logo.png';
    }
}

observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
});

// Run it once on script load for any images already in HTML
document.querySelectorAll('img[src*="/api/students/"]').forEach(hijackImgSrc);

console.log("[Firebase Mocker] API Call interceptions active.");
