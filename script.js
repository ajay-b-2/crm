import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, onSnapshot,
    deleteDoc, doc, query, where, updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import {
    getAuth, createUserWithEmailAndPassword,
    signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 🔧 Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyDI_b1B5n6_fPjxNhOUmKHDMUq33VYpyKg",
    authDomain: "crm-data-e7511.firebaseapp.com",
    projectId: "crm-data-e7511",
    storageBucket: "crm-data-e7511.appspot.com",
    messagingSenderId: "545991868923",
    appId: "1:545991868923:web:c2de4f9dfb43cc66788b5e"
};

// 🔥 Init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Secondary app to prevent admin from being logged out when creating a user
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

// ---------------- AUTH ---------------- //

let currentUser = null;

// ✅ ADD USER
async function addUser() {
    const email = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value.trim();
    const role = document.getElementById("newRole").value;

    if (!email || !password) return alert("Fill all fields");

    try {
        // Use secondary auth to create user so admin doesn't get signed out
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        await signOut(secondaryAuth); // immediately sign out of secondary app

        await addDoc(collection(db, 'users'), {
            uid: userCredential.user.uid,
            username: email,
            role: role
        });

        alert("User created successfully");
        document.getElementById("newUsername").value = "";
        document.getElementById("newPassword").value = "";

    } catch (e) {
        console.error(e);
        alert(e.message);
    }
}





// ✅ LOGIN
async function login() {
    const email = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Enter email and password");
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        console.log("Logged in:", user.uid);

        // 🔎 Get role from Firestore
        const q = query(collection(db, 'users'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();

            console.log("User data:", userData);

            localStorage.setItem('crm_active_user', JSON.stringify({
                uid: user.uid,
                username: userData.username,
                role: userData.role
            }));

            window.location.href = "dashboard.html";

        } else {
            alert("User role not found. Create user first.");
        }

    } catch (e) {
        console.error("LOGIN ERROR:", e);
        const errDiv = document.getElementById("loginError");
        if (errDiv) {
            errDiv.style.display = "block";
            errDiv.innerText = "Invalid credentials. Please try again.";
        } else {
            alert("Invalid login");
        }
    }
}

// ✅ REGISTER (For initial setup)
async function register() {
    const email = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Enter email and password");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Auto-assign Admin role if it's the admin email, otherwise Staff
        const role = email === 'admin@gmail.com' ? 'Admin' : 'Staff';

        await addDoc(collection(db, 'users'), {
            uid: user.uid,
            username: email,
            role: role
        });

        localStorage.setItem('crm_active_user', JSON.stringify({
            uid: user.uid,
            username: email,
            role: role
        }));

        window.location.href = "dashboard.html";

    } catch (e) {
        console.error("REGISTER ERROR:", e);
        const errDiv = document.getElementById("loginError");
        if (errDiv) {
            errDiv.style.display = "block";
            errDiv.innerText = e.message;
        } else {
            alert(e.message);
        }
    }
}

// ✅ LOGOUT (FIXED)
async function logout() {
    try {
        await signOut(auth);

        localStorage.clear();

        window.location.replace("/");
    } catch (e) {
        console.error("Logout error:", e);
    }
}

// ---------------- APP INIT ---------------- //

let customers = [];
let users = [];

const navItem = document.querySelector(".nav-item");
if (navItem) {
    navItem.addEventListener("click", () => {
        switchTab('home');
    });
}

if (window.location.pathname.includes("dashboard.html")) {

    window.onload = function () {

        const activeUser = localStorage.getItem('crm_active_user');

        if (!activeUser) {
            window.location.replace("/");
            return;
        }

        currentUser = JSON.parse(activeUser);

        // ✅ Set user info
        document.getElementById("currentUserName").innerText = currentUser.username;
        document.getElementById("currentUserRole").innerText = currentUser.role;

        // ✅ Role check
        const role = currentUser.role.trim().toLowerCase();

        if (role === "admin") {
            document.getElementById("nav-admin").style.display = "flex";
            listenToUsers();
        } else {
            const earn = document.getElementById("card-earnings");
            if (earn) earn.style.display = "none";
        }

        // ✅ Start listeners
        listenToCustomers();
        hideLoader();
    };
}
function hideLoader() {
    setTimeout(() => {
        const loader = document.getElementById("loadingScreen");
        if (loader) {
            loader.style.opacity = "0";
            setTimeout(() => loader.style.display = "none", 300);
        }
    }, 800); // adjust based on loading speed
}

document.addEventListener("click", function(e) {
    const sidebar = document.querySelector(".sidebar");
    const button = document.querySelector(".menu-toggle");

    if (!sidebar.contains(e.target) && !button.contains(e.target)) {
        sidebar.classList.remove("active");
    }
});

function toggleMenu() {
    document.querySelector(".sidebar").classList.toggle("active");
}





// ---------------- LISTENERS ---------------- //

function listenToCustomers() {
    onSnapshot(collection(db, 'customers'), snapshot => {
        customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        updateStats();
        renderDirectory();
        renderPipeline();

        // ✅ Hide loader AFTER data comes
        hideLoader();
    });
}

function listenToUsers() {
    onSnapshot(collection(db, 'users'), snapshot => {
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAdmin();
    });
}

// ---------------- ADMIN ---------------- //

function renderAdmin() {
    if (!currentUser || currentUser.role.toLowerCase() !== 'admin') return;

    const listEl = document.getElementById("usersList");
    if (!listEl) return;

    listEl.innerHTML = "";

    users.forEach(u => {
        const div = document.createElement("div");

        div.innerHTML = `
            <strong>${u.username}</strong> - ${u.role}
            ${u.username !== currentUser.username ?
                `<button onclick="removeUser('${u.id}')">Remove</button>` :
                `<span>You</span>`
            }
        `;

        listEl.appendChild(div);
    });
}

// ---------------- DELETE USER ---------------- //

async function removeUser(id) {
    if (confirm("Delete user?")) {
        await deleteDoc(doc(db, 'users', id));
    }
}

// ---------------- DASHBOARD & TABS ---------------- //

function switchTab(tabId) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

    const targetSec = document.getElementById('sec-' + tabId);
    if (targetSec) targetSec.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(nav => {
        if (nav.getAttribute('onclick') && nav.getAttribute('onclick').includes(tabId)) {
            nav.classList.add('active');
        }
    });

    const titles = {
        'home': 'Dashboard',
        'directory': 'Directory & Notes',
        'pipeline': 'Sales Pipeline',
        'admin': 'Admin (Boss Mode)'
    };
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle && titles[tabId]) {
        pageTitle.innerText = titles[tabId];
    }
}

function updateStats() {
    const statCust = document.getElementById("stat-customers");
    const statDeals = document.getElementById("stat-deals");
    const statEarn = document.getElementById("stat-earnings");

    if (statCust) statCust.innerText = customers.length;
    if (statDeals) {
        const deals = customers.filter(c => c.status !== 'Client');
        statDeals.innerText = deals.length;
    }
    if (statEarn) {
        const earnings = customers.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
        statEarn.innerText = '₹' + earnings.toLocaleString("en-IN");
    }
}




// ---------------- DIRECTORY ---------------- //

function renderDirectory() {
    const listEl = document.getElementById("customerList");
    if (!listEl) return;
    
    const searchEl = document.getElementById("search");
    const search = searchEl ? searchEl.value.toLowerCase() : "";
    const filterEl = document.getElementById("filterLead");
    const filter = filterEl ? filterEl.value : "all";
    
    let filtered = customers.filter(c => {
        const name = c.name || "";
        const email = c.email || "";
        const matchesSearch = name.toLowerCase().includes(search) || email.toLowerCase().includes(search);
        const matchesFilter = filter === 'all' || c.status === filter;
        return matchesSearch && matchesFilter;
    });
    
    listEl.innerHTML = "";
    
    filtered.forEach(c => {
        const div = document.createElement("div");
        div.className = "glass";
        div.style.padding = "12px";
        div.style.cursor = "pointer";
        div.style.borderRadius = "8px";
        div.onclick = () => selectCustomer(c.id);
        
        div.innerHTML = `
            <div style="font-weight: bold;">${c.name}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${c.email}</div>
            <div style="margin-top: 4px; display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(0,0,0,0.1); font-size: 12px;">${c.status || 'New Lead'}</div>
        `;
        listEl.appendChild(div);
    });
}

function selectCustomer(id) {
    const customer = customers.find(c => c.id === id);
    const profileView = document.getElementById("profileView");
    if (!profileView) return;

    if (!customer) {
        profileView.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-user-astronaut"></i>
                <p>Select a customer to view their profile</p>
            </div>
        `;
        delete profileView.dataset.currentId;
        return;
    }
    
    profileView.dataset.currentId = id;
    
    const canDelete = currentUser && currentUser.role === 'Admin';
    
    profileView.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
                <h2 style="margin: 0; font-size: 24px;">${customer.name}</h2>
                <p style="color: var(--text-secondary); margin: 4px 0 12px 0;">${customer.email} ${customer.phone ? '| ' + customer.phone : ''}</p>
                <div>
                    <span class="role-badge" style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; background: rgba(255,255,255,0.1);">${customer.status || 'New Lead'}</span>
                    <span style="margin-left: 12px; font-weight: bold; color: var(--success);">₹${customer.value || 0}</span>
                </div>
            </div>
            ${canDelete ? `<button onclick="deleteCustomer('${customer.id}')" style="background: var(--danger); padding: 8px 12px; font-size: 12px; border-radius: 8px; color: white; border: none; cursor: pointer;">Delete</button>` : ''}
        </div>
        
        <div style="margin-top: 32px;">
            <h3 style="margin-bottom: 12px; font-size: 18px;">Activity Notes</h3>
            <div id="notesList" style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
                ${(customer.notes || []).map(note => `
                    <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; font-size: 14px; border-left: 3px solid var(--accent);">
                        ${note}
                    </div>
                `).join('')}
                ${!(customer.notes || []).length ? '<div style="color: var(--text-secondary); font-size: 14px; font-style: italic;">No notes yet.</div>' : ''}
            </div>
            
            <div style="margin-top: 16px; display: flex; gap: 8px;">
                <input type="text" id="newNote" placeholder="Add a note..." style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;">
                <button onclick="addNote('${customer.id}')" style="padding: 10px 20px; background: var(--accent); color: white; border: none; border-radius: 8px; cursor: pointer;">Add</button>
            </div>
        </div>
    `;
}

async function addNote(id) {
    const noteInput = document.getElementById("newNote");
    if (!noteInput || !noteInput.value.trim()) return;
    
    const customer = customers.find(c => c.id === id);
    if (!customer) return;
    
    const newNotes = [...(customer.notes || []), noteInput.value.trim()];
    
    try {
        await updateDoc(doc(db, 'customers', id), {
            notes: newNotes
        });
        // UI updates via snapshot listener
    } catch(e) {
        console.error("Failed to add note:", e);
        alert("Failed to add note");
    }
}

async function deleteCustomer(id) {
    if (confirm("Are you sure you want to delete this customer?")) {
        try {
            await deleteDoc(doc(db, 'customers', id));
            const profileView = document.getElementById("profileView");
            if (profileView && profileView.dataset.currentId === id) {
                delete profileView.dataset.currentId;
                selectCustomer(null); // Clear view
            }
        } catch(e) {
            console.error("Failed to delete customer:", e);
        }
    }
}

// ---------------- CUSTOMER CREATION ---------------- //

function showAddCustomerModal() {
    document.getElementById("addCustomerModal").style.display = "flex";
}

function closeAddCustomerModal() {
    document.getElementById("addCustomerModal").style.display = "none";
    document.getElementById("newCustName").value = "";
    document.getElementById("newCustEmail").value = "";
    document.getElementById("newCustPhone").value = "";
    document.getElementById("newCustValue").value = "0";
}

async function addCustomer() {
    const name = document.getElementById("newCustName").value.trim();
    const email = document.getElementById("newCustEmail").value.trim();
    const phone = document.getElementById("newCustPhone").value.trim();
    const value = document.getElementById("newCustValue").value.trim();

    if (!name || !email) {
        alert("Name and Email are required");
        return;
    }

    try {
        await addDoc(collection(db, 'customers'), {
            name: name,
            email: email,
            phone: phone,
            value: Number(value) || 0,
            status: "New Lead",
            notes: []
        });
        
        closeAddCustomerModal();
    } catch (e) {
        console.error("Error adding customer: ", e);
        alert("Failed to add customer");
    }
}


// ---------------- PIPELINE ---------------- //

function renderPipeline() {
    const newCol = document.getElementById("pipe-new");
    const progCol = document.getElementById("pipe-progress");
    const finCol = document.getElementById("pipe-finished");
    
    if (!newCol || !progCol || !finCol) return;
    
    newCol.innerHTML = "";
    progCol.innerHTML = "";
    finCol.innerHTML = "";
    
    let countNew = 0, countProg = 0, countFin = 0;
    
    customers.forEach(c => {
        const card = document.createElement("div");
        card.className = "glass";
        card.style.padding = "16px";
        card.style.marginBottom = "12px";
        card.style.borderRadius = "8px";
        card.style.cursor = "grab";
        card.draggable = true;
        card.id = `card-${c.id}`;
        card.ondragstart = drag;
        
        card.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">${c.name}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">${c.email}</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 12px; padding: 2px 8px; border-radius: 12px; background: rgba(255,255,255,0.1);">${c.status || 'New Lead'}</div>
                <div style="font-size: 14px; font-weight: bold; color: var(--success);">₹${c.value || 0}</div>
            </div>
        `;
        
        const status = c.status || 'New Lead';
        if (status === "New Lead") {
            newCol.appendChild(card);
            countNew++;
        } else if (status === "In Progress" || status === "Hot") {
            progCol.appendChild(card);
            countProg++;
        } else if (status === "Finished" || status === "Client") {
            finCol.appendChild(card);
            countFin++;
        } else {
            newCol.appendChild(card);
            countNew++;
        }
    });
    
    const countNewEl = document.getElementById("count-new");
    const countProgEl = document.getElementById("count-progress");
    const countFinEl = document.getElementById("count-finished");
    
    if (countNewEl) countNewEl.innerText = countNew;
    if (countProgEl) countProgEl.innerText = countProg;
    if (countFinEl) countFinEl.innerText = countFin;
}

function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.currentTarget.id);
}

async function drop(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const card = document.getElementById(data);
    
    const col = ev.target.closest('.kanban-cards');
    if (!col || !card) return;
    
    col.appendChild(card);
    
    const customerId = data.replace('card-', '');
    const newStage = col.getAttribute('data-stage');
    
    let newStatus = "New Lead";
    if (newStage === "In Progress") newStatus = "Hot";
    if (newStage === "Finished") newStatus = "Client";
    if (newStage === "New") newStatus = "New Lead";
    
    try {
        await updateDoc(doc(db, 'customers', customerId), {
            status: newStatus
        });
    } catch(e) {
        console.error("Failed to update status:", e);
    }
}

function openSettings(section) {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    // Hide all specific sections
    document.getElementById('settings-home').style.display = 'none';
    document.getElementById('settings-directory').style.display = 'none';
    document.getElementById('settings-pipeline').style.display = 'none';
    document.getElementById('settings-admin').style.display = 'none';
    // Show relevant
    if (section === 'home') document.getElementById('settings-home').style.display = 'block';
    else if (section === 'directory') document.getElementById('settings-directory').style.display = 'block';
    else if (section === 'pipeline') document.getElementById('settings-pipeline').style.display = 'block';
    else if (section === 'admin') document.getElementById('settings-admin').style.display = 'block';
    modal.style.display = 'flex';
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.style.display = 'none';
}

function applySettings() {
    // Example: toggle dark mode
    const dark = document.getElementById('toggleDarkMode')?.checked;
    if (dark !== undefined) {
        document.documentElement.style.filter = dark ? 'invert(1) hue-rotate(180deg)' : 'none';
    }
    // Directory notes toggle (placeholder)
    const showNotes = document.getElementById('toggleShowNotes')?.checked;
    if (showNotes !== undefined) {
        const notes = document.querySelectorAll('#profileView .role-badge');
        notes.forEach(n => n.style.display = showNotes ? 'inline-block' : 'none');
    }
    // Auto sort placeholder
    const autoSort = document.getElementById('toggleAutoSort')?.checked;
    if (autoSort) {
        // Simple re-render to sort cards by value descending
        customers.sort((a,b)=> (b.value||0)-(a.value||0));
        renderPipeline();
    }
    // Feature X placeholder
    // For now just log
    console.log('Settings applied');
    closeSettings();
}


// ✅ Make functions global
window.switchTab = switchTab;
window.logout = logout;
window.login = login;
window.addUser = addUser;
window.removeUser = removeUser;
window.renderDirectory = renderDirectory;
window.selectCustomer = selectCustomer;
window.addNote = addNote;
window.deleteCustomer = deleteCustomer;
window.allowDrop = allowDrop;
window.drag = drag;
window.drop = drop;
window.showAddCustomerModal = showAddCustomerModal;
window.closeAddCustomerModal = closeAddCustomerModal;
window.addCustomer = addCustomer;
window.register = register;
